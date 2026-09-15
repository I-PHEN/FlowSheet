/**
 * tourBus — one tiny event bus for "a narrated tour is running".
 *
 * The floating Build button ducks while a tour speaks, on any page, without
 * knowing anything about the page. Workspaces and the project viewer just
 * publish; the button subscribes.
 */

const EVENT = 'fs:tour';

export function setTourActive(active: boolean): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { active } }));
}

export function onTourChange(fn: (active: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => fn(Boolean((e as CustomEvent<{ active: boolean }>).detail?.active));
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
