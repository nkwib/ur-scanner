import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export interface Fixture {
	type: string;
	payloadHex?: string;
	fragmentCount?: number;
	parts: string[];
}

export function loadFixture(name: string): Fixture {
	return JSON.parse(readFileSync(join(dir, name), 'utf8')) as Fixture;
}

export function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
