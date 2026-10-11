import { callGemini } from '@/lib/ai/client';
import {
  SUGGEST_RESPONSE_SCHEMA,
  suggestResponseSchema,
  type SuggestResponse,
} from '@/lib/ai/schemas';

/**
 * Suggest artists worth watching, based on who the user already follows.
 *
 * Spotify's own recommendations and related-artists endpoints are unavailable
 * to apps created after November 2024, so this uses Gemini — the same model
 * the rest of the pipeline runs on — rather than a second provider.
 */
export const SUGGEST_SYSTEM_PROMPT = `You suggest live-music artists for someone in India to follow, based on artists they already follow.

Rules:
- Suggest artists musically close to the ones listed, who realistically play live.
- Strongly prefer artists who tour India or have played India: Indian independent and film artists, and international artists who include India on tours.
- Never suggest an artist already on the list, under any spelling or alias.
- Never suggest a dissolved act or a deceased solo artist; they will never announce a show.
- aliases: other spellings or birth names that news coverage might use. Empty array if there are none.
- similar_to: the one followed artist this suggestion most resembles, copied exactly from the list.
- reason: one short sentence, concrete about the musical link. No marketing language.

Return at most 12 suggestions, ordered by how likely the person is to want them.`;

export async function suggestArtists(
  followed: readonly { name: string; isStarred: boolean }[],
  homeCity: string,
  options: { scanRunId?: string | null } = {},
): Promise<{ suggestions: SuggestResponse['suggestions']; error?: string }> {
  if (followed.length === 0) return { suggestions: [] };

  const starred = followed.filter((artist) => artist.isStarred).map((artist) => artist.name);
  const rest = followed.filter((artist) => !artist.isStarred).map((artist) => artist.name);

  const call = await callGemini({
    task: 'suggest',
    systemInstruction: SUGGEST_SYSTEM_PROMPT,
    prompt: `Home city: ${homeCity}

ALREADY FOLLOWED — never suggest any of these:
${[...starred, ...rest].map((name) => `- ${name}`).join('\n')}

The starred ones matter most: ${starred.join(', ') || 'none'}.`,
    responseSchema: SUGGEST_RESPONSE_SCHEMA,
    validator: suggestResponseSchema,
    scanRunId: options.scanRunId,
  });

  if (!call.ok) return { suggestions: [], error: call.error };
  return { suggestions: call.data.suggestions };
}
