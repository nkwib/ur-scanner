/**
 * `<ur-scanner>` - a framework-agnostic custom element wrapping the decode core
 * and camera source. Importing this module is BROWSER-ONLY (it extends
 * `HTMLElement` at evaluation time); in SSR frameworks import it from an
 * `onMount`/`useEffect`, or via the side-effectful `@nkwib/ur-scanner/element`
 * subpath. See `docs/howto/frameworks.md` and `docs/reference.md`.
 *
 * Attributes:  `expected-type`, `facing-mode`, `scan-interval`, `auto-start`,
 *              `fixture` (JSON array of part strings for one-device/demo mode).
 * Events:      `ur-progress`, `ur-complete`, `ur-error`, `ur-ignore`.
 * CSS parts:   `container`, `video`, `overlay`, `ring`, `status`, `controls`,
 *              `camera-select`, `torch-button`.
 * Methods:     `start()`, `stop()`, `reset()`.
 */
import { fromCamera, type CameraController } from './sources/camera.js';
import { playFixture } from './sources/fixture.js';
import { URReceiver } from './receiver.js';
import type { DecodedUR, IgnoredFrame, Progress } from './types.js';
import type { URScannerError } from './errors.js';

const TEMPLATE = `
<style>
  :host { display: block; position: relative; inline-size: 100%; max-inline-size: 480px; font: inherit; }
  .container { position: relative; aspect-ratio: 1 / 1; background: #000; border-radius: 12px; overflow: hidden; }
  video { inline-size: 100%; block-size: 100%; object-fit: cover; display: block; }
  .overlay { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
  .ring { inline-size: 40%; block-size: 40%; }
  .ring circle { fill: none; stroke-width: 6; }
  .ring .track { stroke: rgba(255,255,255,0.25); }
  .ring .fill { stroke: #4ade80; stroke-linecap: round; transition: stroke-dashoffset 0.2s ease; transform: rotate(-90deg); transform-origin: 50% 50%; }
  .status { position: absolute; inset-block-end: 0; inset-inline: 0; padding: 8px 12px; color: #fff; background: linear-gradient(transparent, rgba(0,0,0,0.65)); font-size: 14px; }
  .controls { display: flex; gap: 8px; margin-block-start: 8px; align-items: center; flex-wrap: wrap; }
  .controls select, .controls button { font: inherit; padding: 6px 10px; border-radius: 8px; border: 1px solid #8884; background: #fff2; color: inherit; cursor: pointer; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
<div class="container" part="container">
  <video part="video" playsinline muted></video>
  <div class="overlay" part="overlay">
    <svg class="ring" part="ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle class="track" cx="50" cy="50" r="45"></circle>
      <circle class="fill" cx="50" cy="50" r="45" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"></circle>
    </svg>
  </div>
  <div class="status" part="status"></div>
</div>
<div class="controls" part="controls">
  <select part="camera-select" aria-label="Camera" hidden></select>
  <button part="torch-button" type="button" hidden>Torch</button>
</div>
<p class="sr-only" role="status" aria-live="polite"></p>
`;

export class URScannerElement extends HTMLElement {
	static get observedAttributes(): string[] {
		return ['expected-type', 'facing-mode', 'scan-interval', 'fixture'];
	}

	private root: ShadowRoot;
	private controller: CameraController | null = null;
	private fixturePlayer: { stop: () => void } | null = null;
	private receiver: URReceiver | null = null;
	private torchOn = false;

	constructor() {
		super();
		this.root = this.attachShadow({ mode: 'open' });
		this.root.innerHTML = TEMPLATE;
	}

	private get $video() {
		return this.root.querySelector('video') as HTMLVideoElement;
	}
	private get $fill() {
		return this.root.querySelector('.fill') as SVGCircleElement;
	}
	private get $status() {
		return this.root.querySelector('.status') as HTMLElement;
	}
	private get $live() {
		return this.root.querySelector('[aria-live]') as HTMLElement;
	}
	private get $select() {
		return this.root.querySelector('[part="camera-select"]') as HTMLSelectElement;
	}
	private get $torch() {
		return this.root.querySelector('[part="torch-button"]') as HTMLButtonElement;
	}

	connectedCallback(): void {
		this.$select.addEventListener('change', () => {
			if (this.controller) void this.controller.switchCamera(this.$select.value);
		});
		this.$torch.addEventListener('click', () => {
			this.torchOn = !this.torchOn;
			void this.controller?.torch(this.torchOn);
		});
		if (this.hasAttribute('auto-start')) void this.start();
	}

	disconnectedCallback(): void {
		this.stop();
	}

	attributeChangedCallback(): void {
		// Attributes are read at start(); if running, restart to apply.
		if (this.controller || this.fixturePlayer) {
			this.stop();
			void this.start();
		}
	}

	/** Begin scanning. Uses `fixture` mode when the attribute is present. */
	async start(): Promise<void> {
		this.stop();
		const expectedType = this.getAttribute('expected-type') ?? undefined;
		const receiver = (this.receiver = new URReceiver({
			expectedType,
			onProgress: (p) => this.onProgress(p),
			onComplete: (u) => this.onComplete(u),
			onError: (e) => this.onError(e),
			onIgnore: (i) => this.onIgnore(i)
		}));

		const fixture = this.getAttribute('fixture');
		if (fixture) {
			let parts: string[] = [];
			try {
				parts = JSON.parse(fixture);
			} catch {
				this.setStatus('Invalid fixture JSON');
				return;
			}
			this.$video.hidden = true;
			this.fixturePlayer = playFixture(parts, { receiver, intervalMs: 250, loop: true });
			return;
		}

		try {
			const facing = this.getAttribute('facing-mode') ?? 'environment';
			const scanIntervalMs = Number(this.getAttribute('scan-interval')) || undefined;
			this.controller = await fromCamera({
				video: this.$video,
				receiver,
				scanIntervalMs,
				constraints: { video: { facingMode: facing } }
			});
			await this.populateCameras();
			if (this.controller.hasTorch()) this.$torch.hidden = false;
		} catch (err) {
			this.onError(err as URScannerError);
		}
	}

	/** Stop scanning and release the camera. Safe to call repeatedly. */
	stop(): void {
		this.controller?.stop();
		this.controller = null;
		this.fixturePlayer?.stop();
		this.fixturePlayer = null;
	}

	/** Discard progress and restart the current source. */
	reset(): void {
		void this.start();
	}

	private async populateCameras(): Promise<void> {
		if (!this.controller) return;
		const inputs = await this.controller.listVideoInputs();
		if (inputs.length < 2) return;
		this.$select.innerHTML = '';
		inputs.forEach((d, i) => {
			const opt = document.createElement('option');
			opt.value = d.deviceId;
			opt.textContent = d.label || `Camera ${i + 1}`;
			this.$select.append(opt);
		});
		this.$select.hidden = false;
	}

	private onProgress(p: Progress): void {
		const offset = 100 - Math.round(p.estimatedPercent * 100);
		this.$fill.setAttribute('stroke-dashoffset', String(offset));
		const pct = Math.round(p.estimatedPercent * 100);
		const label = p.expectedPartCount
			? `${pct}% - ${p.receivedParts} of ${p.expectedPartCount} parts`
			: 'Point at an animated QR';
		this.setStatus(label);
		this.dispatchEvent(new CustomEvent('ur-progress', { detail: p, bubbles: true, composed: true }));
	}

	private onComplete(u: DecodedUR): void {
		this.setStatus(`Received ${u.cbor.length} bytes (${u.type})`);
		this.$live.textContent = 'Scan complete.';
		this.dispatchEvent(new CustomEvent('ur-complete', { detail: u, bubbles: true, composed: true }));
	}

	private onError(e: URScannerError): void {
		this.setStatus(e.message);
		this.dispatchEvent(new CustomEvent('ur-error', { detail: e, bubbles: true, composed: true }));
	}

	private onIgnore(i: IgnoredFrame): void {
		this.dispatchEvent(new CustomEvent('ur-ignore', { detail: i, bubbles: true, composed: true }));
	}

	private setStatus(text: string): void {
		this.$status.textContent = text;
		this.$live.textContent = text;
	}
}

/** Define `<ur-scanner>` once. Safe to call multiple times; no-op off-DOM. */
export function defineURScanner(tag = 'ur-scanner'): void {
	if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
		customElements.define(tag, URScannerElement);
	}
}
