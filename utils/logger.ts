/**
 * Dev-only logger that suppresses debug/info/warn output in production.
 * Only error-level logs are emitted in production builds.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const IS_PRODUCTION = (process.env.EXPO_PUBLIC_ENV || '').toLowerCase() === 'production';

/** Scrub emails, JWTs, and UUIDs from log arguments */
function sanitize(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (typeof arg !== 'string') return arg;
    return arg
      .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[EMAIL]')
      .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[JWT]')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[UUID]');
  });
}

function log(level: LogLevel, ...args: unknown[]): void {
  if (IS_PRODUCTION && level !== 'error') return;
  const cleaned = sanitize(args);
  switch (level) {
    case 'debug':
      console.debug(...cleaned);
      break;
    case 'info':
      console.info(...cleaned);
      break;
    case 'warn':
      console.warn(...cleaned);
      break;
    case 'error':
      console.error(...cleaned);
      break;
  }
}

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
};

export default logger;
