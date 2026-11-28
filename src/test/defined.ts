/** Test guard: the value, or a thrown Error naming what was missing. Narrows away null and undefined. */
export function defined<T>(value: T | null | undefined, what = 'value'): T {
  if (value === null || value === undefined) throw new Error(`expected ${what} to be defined`);
  return value;
}
