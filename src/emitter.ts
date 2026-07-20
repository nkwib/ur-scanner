/** Minimal, dependency-free typed event emitter. */
export class Emitter<Events extends Record<string, unknown>> {
	private listeners: { [K in keyof Events]?: Set<(payload: Events[K]) => void> } = {};

	/** Subscribe. Returns an unsubscribe function. */
	on<K extends keyof Events>(type: K, listener: (payload: Events[K]) => void): () => void {
		(this.listeners[type] ??= new Set()).add(listener);
		return () => this.off(type, listener);
	}

	off<K extends keyof Events>(type: K, listener: (payload: Events[K]) => void): void {
		this.listeners[type]?.delete(listener);
	}

	protected emit<K extends keyof Events>(type: K, payload: Events[K]): void {
		for (const listener of this.listeners[type] ?? []) listener(payload);
	}

	/** Drop all subscriptions. */
	protected clearListeners(): void {
		this.listeners = {};
	}
}
