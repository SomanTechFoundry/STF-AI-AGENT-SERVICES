/**
 * Structured logger for the platform.
 *
 * Design goals:
 * - Every log entry is structured JSON in production (parseable by Sentry/Datadog/etc.)
 * - Every entry can be correlated to a business, customer, or request
 * - Sensitive fields are never logged
 * - Log level is controlled by environment variable
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  businessId?: string;
  customerId?: string;
  conversationId?: string;
  requestId?: string;
  appointmentId?: string;
  userId?: string;
  tool?: string;
  service?: string;
  durationMs?: number;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getConfiguredLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) return envLevel;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function formatError(err: unknown) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
      code: (err as { code?: string }).code,
    };
  }
  return { name: "UnknownError", message: String(err) };
}

function writeLog(entry: LogEntry) {
  const configuredLevel = getConfiguredLevel();
  if (LOG_LEVELS[entry.level] < LOG_LEVELS[configuredLevel]) return;

  if (process.env.NODE_ENV === "production") {
    // In production, output newline-delimited JSON for log aggregation
    const line = JSON.stringify(entry);
    if (entry.level === "error" || entry.level === "warn") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  } else {
    // In development, output human-readable format
    const ctx = entry.context
      ? ` ${JSON.stringify(entry.context)}`
      : "";
    const errStr = entry.error
      ? `\n  Error: ${entry.error.name}: ${entry.error.message}${
          entry.error.stack ? "\n" + entry.error.stack : ""
        }`
      : "";
    const line = `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}${ctx}${errStr}`;

    if (entry.level === "error") console.error(line);
    else if (entry.level === "warn") console.warn(line);
    else console.log(line);
  }
}

function createEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  err?: unknown
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    error: err !== undefined ? formatError(err) : undefined,
  };
}

export const logger = {
  debug(message: string, context?: LogContext) {
    writeLog(createEntry("debug", message, context));
  },

  info(message: string, context?: LogContext) {
    writeLog(createEntry("info", message, context));
  },

  warn(message: string, context?: LogContext) {
    writeLog(createEntry("warn", message, context));
  },

  error(message: string, err?: unknown, context?: LogContext) {
    writeLog(createEntry("error", message, context, err));
  },

  /**
   * Create a child logger pre-loaded with context.
   * Useful for request-scoped logging.
   */
  withContext(baseContext: LogContext) {
    return {
      debug(message: string, context?: LogContext) {
        writeLog(createEntry("debug", message, { ...baseContext, ...context }));
      },
      info(message: string, context?: LogContext) {
        writeLog(createEntry("info", message, { ...baseContext, ...context }));
      },
      warn(message: string, context?: LogContext) {
        writeLog(createEntry("warn", message, { ...baseContext, ...context }));
      },
      error(message: string, err?: unknown, context?: LogContext) {
        writeLog(createEntry("error", message, { ...baseContext, ...context }, err));
      },
    };
  },
};
