/**
 * The seeded artist list — the only hard-coded data in the app. Shows are never
 * seeded; they always come from live sources.
 *
 * Format: name | aliases | starred
 */
export const DEMO_ARTISTS_TABLE = `
Prateek Kuhad | | yes
Ritviz | Ritviz Srivastava | yes
Lifafa | Suryakant Sawhney | yes
The Peter Cat Recording Co. | Peter Cat Recording Co, PCRC | yes
A. R. Rahman | AR Rahman, A.R. Rahman | yes
Pritam | Pritam Chakraborty | no
Taylor Swift | | no
Lana Del Rey | | no
Ariana Grande | | no
Harry Styles | | no
Guns N' Roses | Guns and Roses, GNR | no
The Beatles | Beatles | no
ABBA | | no
Queen | Queen + Adam Lambert | no
Frank Sinatra | | no
Nancy Sinatra | | no
The Weeknd | Abel Tesfaye | no
Drake | | no
Kendrick Lamar | | no
Eagles | The Eagles | no
`;

export type DemoArtist = { name: string; aliases: string[]; starred: boolean };

export function parseDemoArtists(table: string = DEMO_ARTISTS_TABLE): DemoArtist[] {
  return table
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, aliasCell = '', starredCell = 'no'] = line.split('|').map((c) => c.trim());
      return {
        name,
        aliases: aliasCell
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        starred: starredCell.toLowerCase() === 'yes',
      };
    });
}
