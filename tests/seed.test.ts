import { describe, expect, it } from 'vitest';
import { parseDemoArtists } from '../lib/demo-artists';

describe('parseDemoArtists', () => {
  const rows = parseDemoArtists();

  it('parses all 20 demo artists', () => {
    expect(rows).toHaveLength(20);
  });

  it('marks exactly the five starred artists', () => {
    const starred = rows.filter((r) => r.starred).map((r) => r.name);
    expect(starred).toEqual([
      'Prateek Kuhad',
      'Ritviz',
      'Lifafa',
      'The Peter Cat Recording Co.',
      'A. R. Rahman',
    ]);
  });

  it('splits aliases and leaves empty alias cells as an empty array', () => {
    const pcrc = rows.find((r) => r.name === 'The Peter Cat Recording Co.');
    expect(pcrc?.aliases).toEqual(['Peter Cat Recording Co', 'PCRC']);
    expect(rows.find((r) => r.name === 'Taylor Swift')?.aliases).toEqual([]);
  });

  it('keeps names with apostrophes and plus signs intact', () => {
    expect(rows.find((r) => r.name === "Guns N' Roses")?.aliases).toEqual([
      'Guns and Roses',
      'GNR',
    ]);
    expect(rows.find((r) => r.name === 'Queen')?.aliases).toEqual(['Queen + Adam Lambert']);
  });
});
