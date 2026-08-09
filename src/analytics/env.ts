// blank Vite env vars = empty strings -> ?? alone passes them through
export function env(name: string, fallback: string): string {
  const value = import.meta.env[name] as string | undefined;
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}
