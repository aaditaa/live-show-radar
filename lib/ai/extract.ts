import { callGemini } from '@/lib/ai/client';
import {
  EXTRACT_RESPONSE_SCHEMA,
  extractResponseSchema,
  type ExtractResponse,
} from '@/lib/ai/schemas';
import type { SourceItem } from '@/db/schema';

/** Gemini Task 1: turn raw search items into structured show candidates. */
export const EXTRACT_SYSTEM_PROMPT = `You extract live-show announcements for India from news headlines and search results.

You are given one or more artists (with aliases) and a list of search items. Return every concrete live performance in India by one of those artists that the items actually report.

INCLUDE:
- Concrete live performances in India by the given artist.
- A festival lineup that includes the artist: set is_festival true and festival_name.

REPORT, DO NOT SILENTLY DROP:
Return a candidate for any item that plausibly concerns one of these artists performing live,
including ones that should not qualify, and mark them honestly. The caller filters on your
fields, so an accurate "no" is as useful as a "yes":
- A show outside India: set country to the real country, e.g. "United States".
- A past show, recap or review: set is_show_announcement false.
- A tribute act, cover band, or a DJ playing the artist's music: is_show_announcement false. A
  "Beatles tribute night" is not The Beatles.
- A film screening, listening party or album release: is_show_announcement false.
- A rumour with no date and no city: is_show_announcement false.
- An unrelated namesake: "Queen" may be the British monarchy or a cricket headline, "Eagles" may
  be the American football team. Set artist_match_confidence below 0.3 and say which artist the
  item names in artist_name.
- A different artist who merely appears in the same article: return it under that artist's name
  with a low artist_match_confidence, rather than attributing their show to the artist asked for.

Omit only items with no connection to live music by anyone — a fuel surcharge story, a hotel
listing. Those are noise, not decisions.

RULES:
- Every field must be supported by the item text. If the text does not say it, the field is null. Never invent prices, dates, venues, ticket links or platforms.
- artist_match_confidence is how certain you are the item is about this artist performing: 1.0 for an explicit named announcement, below 0.7 if you are guessing.
- is_show_announcement is false for anything you would exclude above. Still return the row with the reason reflected in the other fields when you are unsure.
- country is the country of the performance, e.g. "India". If the show is elsewhere, say so honestly rather than forcing "India".
- Dates are ISO. Use YYYY-MM-DD with date_precision "day". If only the month is known, use the first of that month with date_precision "month".
- early_bird_status: "open" when early-bird or pre-sale tickets are on sale now; "imminent" when the text says early-bird or pre-sale opens at a future time; "sold_out", "closed", or "not_mentioned" otherwise. Capture any deadline or limited-quantity wording in early_bird_note, e.g. "first 200 passes only".
- evidence is a short direct quote from the item that supports the show. source_url is the url of the item the show came from.
- Return {"shows": []} only when no item relates to live music at all. For an artist who is not touring India, returning the foreign or past shows you did find, correctly marked, is the right answer.`;

export type ExtractInputArtist = { name: string; aliases: string[] };

/** Keeps the prompt bounded so one artist with a busy news week cannot blow up the call. */
export const MAX_ITEMS_PER_CALL = 25;

export function buildExtractPrompt(
  artists: readonly ExtractInputArtist[],
  items: readonly Pick<SourceItem, 'url' | 'title' | 'snippet' | 'publishedAt' | 'source'>[],
  today: Date = new Date(),
): string {
  const artistBlock = artists
    .map((artist) =>
      artist.aliases.length > 0
        ? `- ${artist.name} (also known as: ${artist.aliases.join(', ')})`
        : `- ${artist.name}`,
    )
    .join('\n');

  const itemBlock = items
    .slice(0, MAX_ITEMS_PER_CALL)
    .map((item, index) => {
      const published = item.publishedAt
        ? new Date(item.publishedAt).toISOString().slice(0, 10)
        : 'unknown';
      return [
        `[${index + 1}] source: ${item.source}  published: ${published}`,
        `title: ${item.title ?? '(no title)'}`,
        item.snippet ? `snippet: ${item.snippet}` : null,
        `url: ${item.url}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return `Today is ${today.toISOString().slice(0, 10)}.

ARTISTS TO MATCH:
${artistBlock}

SEARCH ITEMS:
${itemBlock}`;
}

export async function extractShows(
  artists: readonly ExtractInputArtist[],
  items: readonly Pick<SourceItem, 'url' | 'title' | 'snippet' | 'publishedAt' | 'source'>[],
  options: { scanRunId?: string | null; today?: Date } = {},
): Promise<{ shows: ExtractResponse['shows']; error?: string }> {
  if (items.length === 0 || artists.length === 0) return { shows: [] };

  const result = await callGemini({
    task: 'extract',
    systemInstruction: EXTRACT_SYSTEM_PROMPT,
    prompt: buildExtractPrompt(artists, items, options.today),
    responseSchema: EXTRACT_RESPONSE_SCHEMA,
    validator: extractResponseSchema,
    scanRunId: options.scanRunId,
  });

  if (!result.ok) return { shows: [], error: result.error };
  return { shows: result.data.shows };
}
