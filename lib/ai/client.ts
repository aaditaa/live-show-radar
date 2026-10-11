import { GoogleGenAI } from '@google/genai';
import type { ZodType } from 'zod';
import { aiCalls } from '@/db/schema';
import { db } from '@/lib/db';
import { GEMINI_MODEL, requireEnv } from '@/lib/env';
import { errorMessage } from '@/lib/http';

export type AiTask = 'extract' | 'reconcile' | 'alert' | 'suggest';

let client: GoogleGenAI | undefined;

/** Every AI call in this app goes through Gemini. There is no other provider. */
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: requireEnv('GEMINI_API_KEY') });
  return client;
}

export type GeminiCallResult<T> =
  | { ok: true; data: T; latencyMs: number }
  | { ok: false; error: string; latencyMs: number };

type CallOptions<T> = {
  task: AiTask;
  systemInstruction: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
  validator: ZodType<T>;
  scanRunId?: string | null;
};

/**
 * One structured Gemini call, validated with zod. Invalid output is retried
 * once; a second failure is logged and skipped, never thrown at the caller.
 * Generation settings are left at the model's defaults, as specified.
 */
export async function callGemini<T>(options: CallOptions<T>): Promise<GeminiCallResult<T>> {
  const { task, systemInstruction, prompt, responseSchema, validator, scanRunId } = options;
  const model = GEMINI_MODEL();
  const startedAt = Date.now();

  let lastError = 'unknown error';
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await getClient().models.generateContent({
        model,
        contents:
          attempt === 0
            ? prompt
            : // The retry says plainly what went wrong, rather than re-sending the same prompt.
              `${prompt}\n\nYour previous reply did not satisfy the schema (${lastError}). Reply with valid JSON matching the schema exactly.`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
        },
      });

      const usage = response.usageMetadata;
      inputTokens = usage?.promptTokenCount ?? null;
      // Thinking tokens are billed as output, so they belong in the total.
      outputTokens =
        (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0) || null;

      const text = response.text;
      if (!text) {
        lastError = 'empty response';
        continue;
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        lastError = 'response was not valid JSON';
        continue;
      }

      const validated = validator.safeParse(parsedJson);
      if (!validated.success) {
        lastError = validated.error.issues
          .slice(0, 3)
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        continue;
      }

      const latencyMs = Date.now() - startedAt;
      await logCall({
        scanRunId,
        task,
        model,
        latencyMs,
        inputTokens,
        outputTokens,
        success: true,
        error: null,
      });
      return { ok: true, data: validated.data, latencyMs };
    } catch (error) {
      lastError = errorMessage(error);
      // A transport or quota failure will not be fixed by rephrasing; stop here.
      break;
    }
  }

  const latencyMs = Date.now() - startedAt;
  await logCall({
    scanRunId,
    task,
    model,
    latencyMs,
    inputTokens,
    outputTokens,
    success: false,
    error: lastError,
  });
  return { ok: false, error: lastError, latencyMs };
}

async function logCall(row: {
  scanRunId?: string | null;
  task: AiTask;
  model: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  success: boolean;
  error: string | null;
}): Promise<void> {
  try {
    await db.insert(aiCalls).values({
      scanRunId: row.scanRunId ?? null,
      task: row.task,
      model: row.model,
      latencyMs: row.latencyMs,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      success: row.success,
      error: row.error,
    });
  } catch {
    // Telemetry must never break a scan.
  }
}
