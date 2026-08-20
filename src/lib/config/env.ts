/**
 * Environment variable validation and typed access.
 *
 * All environment variables are accessed through this module.
 * At startup, required variables are validated. Missing variables
 * throw a ConfigurationError with a clear message rather than
 * silently failing at runtime.
 *
 * SECURITY: Never log or expose the values of secrets.
 */

import { ConfigurationError } from "@/lib/errors";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new ConfigurationError(
      `Required environment variable "${name}" is missing or empty. ` +
      `Check your .env.local file and deployment configuration.`
    );
  }
  return value.trim();
}

function optionalEnv(name: string, defaultValue?: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim() === "") return defaultValue;
  return value.trim();
}

function requirePositiveInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new ConfigurationError(
      `Environment variable "${name}" must be a positive integer, got: "${raw}"`
    );
  }
  return parsed;
}

/**
 * Typed, validated environment configuration.
 * Call env() anywhere to get the config — it is validated lazily on first access.
 *
 * In tests, individual variables can be set via process.env before calling env().
 */
function buildConfig() {
  const nodeEnv = (process.env.NODE_ENV ?? "development") as
    | "development"
    | "test"
    | "production";

  return {
    nodeEnv,
    isProduction: nodeEnv === "production",
    isDevelopment: nodeEnv === "development",
    isTest: nodeEnv === "test",

    // Database
    database: {
      url: requireEnv("DATABASE_URL"),
      directUrl: optionalEnv("DIRECT_URL"),
    },

    // AI Providers — only Gemini required for Phase 3+
    ai: {
      geminiApiKey: optionalEnv("GEMINI_API_KEY"),
      openaiApiKey: optionalEnv("OPENAI_API_KEY"),
      anthropicApiKey: optionalEnv("ANTHROPIC_API_KEY"),
      defaultProvider: (optionalEnv("AI_DEFAULT_PROVIDER", "gemini") as
        | "gemini"
        | "openai"
        | "anthropic"),
    },

    // Twilio (Phase 5)
    twilio: {
      accountSid: optionalEnv("TWILIO_ACCOUNT_SID"),
      authToken: optionalEnv("TWILIO_AUTH_TOKEN"),
      phoneNumber: optionalEnv("TWILIO_PHONE_NUMBER"),
    },

    // Google Calendar (Phase 4)
    google: {
      clientId: optionalEnv("GOOGLE_CLIENT_ID"),
      clientSecret: optionalEnv("GOOGLE_CLIENT_SECRET"),
      redirectUri: optionalEnv("GOOGLE_REDIRECT_URI"),
    },

    // Resend (Phase 5)
    resend: {
      apiKey: optionalEnv("RESEND_API_KEY"),
      fromEmail: optionalEnv("RESEND_FROM_EMAIL", "noreply@yourdomain.com"),
    },

    // Stripe (future)
    stripe: {
      secretKey: optionalEnv("STRIPE_SECRET_KEY"),
      webhookSecret: optionalEnv("STRIPE_WEBHOOK_SECRET"),
    },

    // Sentry (Phase 6)
    sentry: {
      dsn: optionalEnv("SENTRY_DSN"),
    },

    // Application
    app: {
      url: optionalEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
      apiSecret: optionalEnv("API_SECRET_KEY"),
      logLevel: (optionalEnv("LOG_LEVEL", "info") as
        | "debug"
        | "info"
        | "warn"
        | "error"),
    },

    // Rate limiting
    rateLimit: {
      agentRequestsPerMinute: requirePositiveInt(
        "RATE_LIMIT_AGENT_RPM",
        60
      ),
    },
  } as const;
}

let _config: ReturnType<typeof buildConfig> | null = null;

/**
 * Get the typed environment configuration.
 * Validates all required variables on first call.
 * Subsequent calls return the cached config.
 */
export function env(): ReturnType<typeof buildConfig> {
  if (!_config) {
    _config = buildConfig();
  }
  return _config;
}

/**
 * Reset the cached config. Only used in tests to allow
 * environment variable overrides between test cases.
 */
export function resetEnvCache() {
  _config = null;
}
