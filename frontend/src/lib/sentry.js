import * as Sentry from "@sentry/react";

// No-op unless VITE_SENTRY_DSN is configured at build time.
export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    sendDefaultPii: false
  });
};

export const captureException = (error) => {
  if (import.meta.env.VITE_SENTRY_DSN) Sentry.captureException(error);
};
