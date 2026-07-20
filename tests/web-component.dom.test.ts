import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineURScanner } from '../src/web-component.js';
import { loadFixture } from './helpers.js';

const multi = loadFixture('bytes.multipart.json');
defineURScanner();

afterEach(() => {
	document.body.innerHTML = '';
	vi.useRealTimers();
});

describe('<ur-scanner> custom element (fixture mode)', () => {
	it('registers as a custom element', () => {
		expect(customElements.get('ur-scanner')).toBeDefined();
	});

	it('emits ur-progress and ur-complete when playing a fixture', async () => {
		vi.useFakeTimers();
		const el = document.createElement('ur-scanner');
		el.setAttribute('fixture', JSON.stringify(multi.parts));
		el.setAttribute('expected-type', 'bytes');
		document.body.append(el);

		const progressed = vi.fn();
		let completedBytes = -1;
		el.addEventListener('ur-progress', () => progressed());
		el.addEventListener('ur-complete', (e) => {
			completedBytes = (e as CustomEvent).detail.cbor.length;
		});

		await (el as HTMLElement & { start(): Promise<void> }).start();
		// fixture player ticks every 250ms; advance generously until complete.
		for (let i = 0; i < multi.parts.length + 4 && completedBytes < 0; i++) {
			await vi.advanceTimersByTimeAsync(250);
		}

		expect(progressed).toHaveBeenCalled();
		expect(completedBytes).toBeGreaterThan(0);
	});

	it('exposes a shadow DOM with a progress ring part', () => {
		const el = document.createElement('ur-scanner');
		document.body.append(el);
		expect(el.shadowRoot?.querySelector('[part="ring"]')).not.toBeNull();
		expect(el.shadowRoot?.querySelector('[aria-live]')).not.toBeNull();
	});
});
