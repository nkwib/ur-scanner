/**
 * Headless decode: no DOM, no camera. Feed part strings from any source into a
 * URReceiver and read the bytes out on completion. This exact file is compiled
 * by `pnpm typecheck`, so the README snippet cannot rot.
 */
import { URReceiver, type DecodedUR } from '../src/index.js';

export function decode(parts: string[]): Promise<DecodedUR> {
	return new Promise((resolve, reject) => {
		const receiver = new URReceiver({
			expectedType: 'bytes',
			onProgress: (p) =>
				console.log(`${Math.round(p.estimatedPercent * 100)}% (${p.receivedParts}/${p.expectedPartCount})`),
			onComplete: resolve,
			onError: reject
		});
		for (const part of parts) {
			if (receiver.addPart(part).complete) return;
		}
	});
}
