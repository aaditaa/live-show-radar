/** Every source normalises to this shape before the pipeline touches it. */
export type SourceName = 'google_news' | 'tavily' | 'gemini_search';

export type NormalisedItem = {
  source: SourceName;
  query: string;
  url: string;
  title: string | null;
  snippet: string | null;
  publishedAt: Date | null;
  /** null for platform sweeps, which are not tied to one artist */
  artistId: string | null;
};

export type SourceError = {
  source: SourceName;
  query: string;
  artist?: string;
  message: string;
};

export type FetchOutcome = {
  items: NormalisedItem[];
  errors: SourceError[];
};
