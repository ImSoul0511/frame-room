/** Keep stateful browser resources alive when Vite re-evaluates their module. */
export function hotSingleton<T>(
  data: Record<string, unknown> | undefined,
  key: string,
  create: () => T,
): T {
  if (!data) return create();
  if (!Object.hasOwn(data, key)) data[key] = create();
  return data[key] as T;
}
