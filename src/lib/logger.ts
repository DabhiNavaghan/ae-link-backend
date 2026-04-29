/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Simple logger that works in Next.js serverless/edge without worker threads.
 * Replaces pino to avoid the worker.js crash in Next.js bundling.
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

const configuredLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (isDevelopment ? 'debug' : 'info');
const configuredLevelIndex = LOG_LEVELS.indexOf(configuredLevel);

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS.indexOf(level) >= configuredLevelIndex;
}

function formatMessage(level: LogLevel, context: Record<string, any> | string, message?: string): string {
  const timestamp = new Date().toISOString();
  const levelStr = level.toUpperCase().padEnd(5);

  if (typeof context === 'string') {
    return `${timestamp} ${levelStr} ${context}`;
  }

  const contextStr = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
  return `${timestamp} ${levelStr} ${message || ''}${contextStr}`;
}

function createLogger(baseContext: Record<string, any> = {}) {
  const log = (level: LogLevel, contextOrMsg: Record<string, any> | string, message?: string) => {
    if (!shouldLog(level)) return;

    let mergedContext: Record<string, any>;
    let msg: string;

    if (typeof contextOrMsg === 'string') {
      mergedContext = baseContext;
      msg = contextOrMsg;
    } else {
      mergedContext = { ...baseContext, ...contextOrMsg };
      msg = message || '';
    }

    const formatted = formatMessage(level, mergedContext, msg);

    switch (level) {
      case 'error':
      case 'fatal':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'debug':
        if (isDevelopment) console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
  };

  return {
    debug: (contextOrMsg: Record<string, any> | string, message?: string) => log('debug', contextOrMsg, message),
    info: (contextOrMsg: Record<string, any> | string, message?: string) => log('info', contextOrMsg, message),
    warn: (contextOrMsg: Record<string, any> | string, message?: string) => log('warn', contextOrMsg, message),
    error: (contextOrMsg: Record<string, any> | string, message?: string) => log('error', contextOrMsg, message),
    fatal: (contextOrMsg: Record<string, any> | string, message?: string) => log('fatal', contextOrMsg, message),
    child: (childContext: Record<string, any>) => createLogger({ ...baseContext, ...childContext }),
  };
}

export const Logger = createLogger();
export default Logger;
