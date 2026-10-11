import { describe, expect, it } from 'vitest';
import { parseArtistInput } from '../lib/artists';

describe('parseArtistInput', () => {
  it('parses one name per line', () => {
    expect(parseArtistInput('Prateek Kuhad\nRitviz')).toEqual([
      { name: 'Prateek Kuhad', aliases: [] },
      { name: 'Ritviz', aliases: [] },
    ]);
  });

  it('reads a second column as aliases', () => {
    expect(parseArtistInput('Ritviz, Ritviz Srivastava')).toEqual([
      { name: 'Ritviz', aliases: ['Ritviz Srivastava'] },
    ]);
  });

  it('respects quotes so an alias list can contain commas', () => {
    expect(
      parseArtistInput('The Peter Cat Recording Co., "Peter Cat Recording Co, PCRC"'),
    ).toEqual([
      {
        name: 'The Peter Cat Recording Co.',
        aliases: ['Peter Cat Recording Co', 'PCRC'],
      },
    ]);
  });

  it('keeps a comma inside a quoted artist name', () => {
    expect(parseArtistInput('"Earth, Wind & Fire"')).toEqual([
      { name: 'Earth, Wind & Fire', aliases: [] },
    ]);
  });

  it('ignores blank lines and surrounding whitespace', () => {
    expect(parseArtistInput('\n  Lifafa  \n\n')).toEqual([{ name: 'Lifafa', aliases: [] }]);
  });

  it('skips a CSV header row', () => {
    expect(parseArtistInput('name,aliases\nLifafa,Suryakant Sawhney')).toEqual([
      { name: 'Lifafa', aliases: ['Suryakant Sawhney'] },
    ]);
  });

  it('drops duplicates within one paste, case-insensitively', () => {
    expect(parseArtistInput('Lifafa\nlifafa\nLIFAFA')).toHaveLength(1);
  });

  it('drops an alias that merely repeats the name', () => {
    expect(parseArtistInput('Lifafa, Lifafa')).toEqual([{ name: 'Lifafa', aliases: [] }]);
  });

  it('de-duplicates repeated aliases', () => {
    expect(parseArtistInput('Lifafa, "Suryakant, Suryakant"')).toEqual([
      { name: 'Lifafa', aliases: ['Suryakant'] },
    ]);
  });

  it('returns nothing for empty input', () => {
    expect(parseArtistInput('')).toEqual([]);
    expect(parseArtistInput('   \n  ')).toEqual([]);
  });

  it('handles CRLF line endings from a Windows CSV', () => {
    expect(parseArtistInput('Lifafa\r\nRitviz')).toHaveLength(2);
  });
});

describe('seeded artists are stored as manual', () => {
  it('the seed script no longer writes the demo source', async () => {
    const { readFileSync } = await import('node:fs');
    const seed = readFileSync(new URL('../scripts/seed.ts', import.meta.url), 'utf8');
    expect(seed).toContain("source: 'manual' as const");
    expect(seed).not.toContain("source: 'demo'");
  });
});
