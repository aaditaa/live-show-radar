/**
 * City normalisation. The pipeline builds dedup_key from the normalised city,
 * so two spellings of one city must collapse to the same show.
 */

const ALIASES: Record<string, string> = {
  bangalore: 'Bengaluru',
  bengaluru: 'Bengaluru',
  blr: 'Bengaluru',
  gurgaon: 'Gurugram',
  gurugram: 'Gurugram',
  bombay: 'Mumbai',
  mumbai: 'Mumbai',
  'navi mumbai': 'Navi Mumbai',
  'new delhi': 'Delhi',
  delhi: 'Delhi',
  ncr: 'Delhi',
  'delhi ncr': 'Delhi',
  calcutta: 'Kolkata',
  kolkata: 'Kolkata',
  madras: 'Chennai',
  chennai: 'Chennai',
  poona: 'Pune',
  pune: 'Pune',
  hyderabad: 'Hyderabad',
  goa: 'Goa',
  'north goa': 'Goa',
  'south goa': 'Goa',
  ahmedabad: 'Ahmedabad',
  jaipur: 'Jaipur',
  kochi: 'Kochi',
  cochin: 'Kochi',
  shillong: 'Shillong',
  chandigarh: 'Chandigarh',
  indore: 'Indore',
  lucknow: 'Lucknow',
};

/** Strip accents, collapse whitespace, drop a trailing ", India" and punctuation. */
function canonicalise(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+india$/, '')
    .trim();
}

/** Title-case a city we have no alias for, so output stays presentable. */
function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function normaliseCity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = canonicalise(raw);
  if (!key) return null;
  return ALIASES[key] ?? titleCase(key);
}

export const HOME_CITY = 'Bengaluru';

export function isHomeCity(city: string | null | undefined): boolean {
  return normaliseCity(city) === HOME_CITY;
}
