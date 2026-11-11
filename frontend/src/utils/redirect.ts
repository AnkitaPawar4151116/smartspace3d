// After login we send people back to the page they originally wanted.
// Only same-site paths are accepted, so nobody can be redirected elsewhere.

const AUTH_PATHS = ['/login', '/register', '/forgot-password']

export function getSafeRedirect(state: unknown): string {
  if (state && typeof state === 'object' && 'from' in state) {
    const from = (state as { from?: unknown }).from
    if (
      typeof from === 'string' &&
      from.startsWith('/') &&
      !from.startsWith('//') &&
      !AUTH_PATHS.includes(from)
    ) {
      return from
    }
  }
  return '/dashboard'
}
