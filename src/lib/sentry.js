import * as Sentry from '@sentry/react'

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return // pas de DSN configuré (dev local, ou avant activation) : no-op
  Sentry.init({ dsn, environment: import.meta.env.MODE, tracesSampleRate: 0 })
}

export { Sentry }
