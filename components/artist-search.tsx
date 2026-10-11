'use client';

import { useEffect, useState, useTransition } from 'react';
import { addArtistFromSearchAction } from '@/app/actions';
import { ArtistAvatar } from '@/components/artist-avatar';

type Result = {
  spotifyId: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
  followers: number | null;
  alreadyAdded: boolean;
};

function formatFollowers(count: number | null): string | null {
  if (count === null) return null;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M listeners`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}K listeners`;
  return `${count} listeners`;
}

export function ArtistSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState<Set<string>>(new Set());

  const term = query.trim();
  const active = term.length >= 2;
  // Results for a term too short to search are simply not rendered, rather
  // than cleared from state inside the effect.
  const visible = active ? results : [];

  useEffect(() => {
    if (term.length < 2) return;

    // Debounce, then ignore the response if the term changed while it was in
    // flight. A cancellation flag tied to the cleanup is correct even when
    // React double-invokes the effect in development.
    let cancelled = false;

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/artists/search?q=${encodeURIComponent(term)}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error ?? `Search failed (HTTP ${res.status})`);
          setResults([]);
        } else {
          setError(null);
          setResults(body.results ?? []);
        }
      } catch {
        if (!cancelled) setError('Could not reach the search endpoint.');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  function add(result: Result) {
    const data = new FormData();
    data.set('name', result.name);
    data.set('spotifyId', result.spotifyId);
    if (result.imageUrl) data.set('imageUrl', result.imageUrl);
    setAdded((prev) => new Set(prev).add(result.spotifyId));
    startTransition(() => {
      void addArtistFromSearchAction(data);
    });
  }

  return (
    <div>
      <label className="sr-only" htmlFor="artist-search">
        Search Spotify for an artist
      </label>
      <input
        id="artist-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search Spotify for an artist…"
        autoComplete="off"
        className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg-deep)] px-4 py-2.5 text-sm placeholder:text-[var(--muted-dim)] focus:border-[var(--accent)] focus:outline-none"
      />

      <div className="mt-3 min-h-[2rem]">
        {active && error ? (
          <p className="text-xs text-rose-300">{error}</p>
        ) : active && searching && visible.length === 0 ? (
          <p className="text-xs text-[var(--muted-dim)]">Searching…</p>
        ) : active && !searching && visible.length === 0 ? (
          <p className="text-xs text-[var(--muted-dim)]">No artists match that.</p>
        ) : visible.length > 0 ? (
          <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {visible.map((result) => {
              const justAdded = added.has(result.spotifyId);
              const disabled = result.alreadyAdded || justAdded || pending;
              return (
                <li
                  key={result.spotifyId}
                  className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel-raised)] p-2.5"
                >
                  <ArtistAvatar name={result.name} imageUrl={result.imageUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{result.name}</p>
                    {[formatFollowers(result.followers), result.genres.slice(0, 2).join(', ')]
                      .filter(Boolean)
                      .join(' · ') ? (
                      <p className="truncate text-[11px] text-[var(--muted-dim)]">
                        {[formatFollowers(result.followers), result.genres.slice(0, 2).join(', ')]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => add(result)}
                    disabled={disabled}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      disabled
                        ? 'cursor-default border border-[var(--line)] text-[var(--muted-dim)]'
                        : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                    }`}
                  >
                    {result.alreadyAdded ? 'On list' : justAdded ? 'Added' : 'Add'}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-[var(--muted-dim)]">
            Type at least two characters. Results come from Spotify&apos;s artist catalogue.
          </p>
        )}
      </div>
    </div>
  );
}
