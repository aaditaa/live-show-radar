import { GoogleGenAI } from '@google/genai';
import { aiCalls } from '@/db/schema';
import { db } from '@/lib/db';
import { ENABLE_GEMINI_GROUNDING, GEMINI_MODEL, optionalEnv } from '@/lib/env';
import { errorMessage } from '@/lib/http';
import type { FetchOutcome, NormalisedItem } from '@/lib/sources/types';

/**
 * Source E: Gemini's google_search tool as a third source for starred artists.
 *
 * Grounding and structured output cannot be combined in one call, so this is
 * used purely for discovery: the model searches, and the URLs it grounded on
 * are harvested as ordinary source items. Extraction still happens in Task 1,
 * so a grounded result is held to exactly the same evidence rules as a Google
 * News or Tavily one, and nothing the model says here is trusted directly.
 *
 * Off by default; the flag exists because grounding needs a paid tier.
 */
export function isGroundingEnabled(): boolean {
  return ENABLE_GEMINI_GROUNDING() && Boolean(optionalEnv('GEMINI_API_KEY'));
}

export function buildGroundingPrompt(artistName: string): string {
  return `Search for upcoming ${artistName} concerts, festival appearances or tour dates in India, and any early-bird or pre-sale ticket windows. Summarise only what the search results actually say. If there is nothing in India, say so.`;
}

type GroundingChunk = { web?: { uri?: string; title?: string } };

export async function searchWithGrounding(
  artistName: string,
  artistId: string | null,
  options: { scanRunId?: string | null } = {},
): Promise<FetchOutcome> {
  const query = buildGroundingPrompt(artistName);
  const model = GEMINI_MODEL();
  const apiKey = optionalEnv('GEMINI_API_KEY');

  if (!apiKey) {
    return {
      items: [],
      errors: [{ source: 'gemini_search', query, artist: artistName, message: 'GEMINI_API_KEY is not set' }],
    };
  }

  const startedAt = Date.now();

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: query,
      config: { tools: [{ googleSearch: {} }] },
    });

    const metadata = response.candidates?.[0]?.groundingMetadata;
    const chunks = (metadata?.groundingChunks ?? []) as GroundingChunk[];
    const usage = response.usageMetadata;

    await db
      .insert(aiCalls)
      .values({
        scanRunId: options.scanRunId ?? null,
        task: 'ground',
        model,
        latencyMs: Date.now() - startedAt,
        inputTokens: usage?.promptTokenCount ?? null,
        outputTokens:
          (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0) || null,
        success: true,
        error: null,
      })
      .catch(() => undefined);

    const seen = new Set<string>();
    const items: NormalisedItem[] = [];

    for (const chunk of chunks) {
      const url = chunk.web?.uri;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      items.push({
        source: 'gemini_search',
        query,
        url,
        title: chunk.web?.title ?? null,
        // The model's own summary is the only text we have for these URLs.
        snippet: response.text?.slice(0, 500) ?? null,
        publishedAt: null,
        artistId,
      });
    }

    return { items, errors: [] };
  } catch (error) {
    await db
      .insert(aiCalls)
      .values({
        scanRunId: options.scanRunId ?? null,
        task: 'ground',
        model,
        latencyMs: Date.now() - startedAt,
        success: false,
        error: errorMessage(error),
      })
      .catch(() => undefined);

    return {
      items: [],
      errors: [
        { source: 'gemini_search', query, artist: artistName, message: errorMessage(error) },
      ],
    };
  }
}
