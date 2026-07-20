import { error } from '@sveltejs/kit';
import docs from '$lib/generated/docs.json';

export const prerender = true;

/** One prerendered entry per generated doc slug (rest param carries slashes). */
export function entries() {
  return Object.keys(docs).map((slug) => ({ slug }));
}

export function load({ params }) {
  const doc = docs[params.slug];
  if (!doc) error(404, 'Documentation page not found');
  return { slug: params.slug, doc };
}
