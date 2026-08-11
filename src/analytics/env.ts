// callers pass literal import.meta.env accesses -> Vite inlines only used vars
export function envOr(value: string | undefined, fallback: string): string {
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}
