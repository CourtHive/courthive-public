/**
 * The read-model (courthive-query) origin.
 *
 * A SEPARATE service from CFS, deliberately: CFS is the mutation authority, and every
 * provider-, person- and team-scoped READ belongs to the warehouse. In development they are
 * different ports — CFS :8383, query :3150 — and in production nginx routes same-origin
 * `/query/*` to the query service, so the `/query` prefix is correct there with nothing to
 * configure.
 *
 * Extracted from `programsApi.ts`, where it was module-private, so the tournament search resolves
 * the SAME origin as the programs reads rather than growing a second answer to the same question.
 *
 * TMX resolves this origin too, in `servicesApi.ts` (`queryServiceUrl`), but by a different
 * mechanism: a build-time `process.env.QUERY_SERVER`. The two are deliberately kept in step and
 * are worth reconciling; until then, changing one means looking at the other.
 */
export function getQueryBaseUrl(): string {
  const local = globalThis.location.host.includes('localhost') || globalThis.location.hostname === '127.0.0.1';
  const win = globalThis as any;
  return win.dev?.queryBaseURL || (local ? 'http://localhost:3150' : '/query');
}
