/**
 * Typed environment access. Values are read lazily so a missing optional key
 * never breaks an unrelated page, and secrets are never logged or echoed.
 */

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const GEMINI_MODEL = () => process.env.GEMINI_MODEL ?? 'gemini-3.8-flash';

export const ENABLE_GEMINI_GROUNDING = () =>
  (process.env.ENABLE_GEMINI_GROUNDING ?? 'false').toLowerCase() === 'true';

export const APP_URL = () => process.env.APP_URL ?? 'http://127.0.0.1:3000';
