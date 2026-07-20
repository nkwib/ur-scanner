import { redirect } from '@sveltejs/kit';

export const prerender = true;

// /docs has no landing of its own; send visitors to the first Diataxis page.
export function load() {
  redirect(308, '/docs/tutorial');
}
