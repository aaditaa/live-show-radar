import { describe, expect, it } from 'vitest';
import { HOME_CITY, isHomeCity, normaliseCity } from '../lib/cities';

describe('normaliseCity', () => {
  it('maps the four required aliases', () => {
    expect(normaliseCity('Bangalore')).toBe('Bengaluru');
    expect(normaliseCity('Gurgaon')).toBe('Gurugram');
    expect(normaliseCity('Bombay')).toBe('Mumbai');
    expect(normaliseCity('New Delhi')).toBe('Delhi');
  });

  it('is case and whitespace insensitive', () => {
    expect(normaliseCity('  bANGALORE ')).toBe('Bengaluru');
    expect(normaliseCity('new   delhi')).toBe('Delhi');
  });

  it('strips a trailing country', () => {
    expect(normaliseCity('Bengaluru, India')).toBe('Bengaluru');
    expect(normaliseCity('Mumbai India')).toBe('Mumbai');
  });

  it('keeps already-canonical names stable (idempotent)', () => {
    for (const city of ['Bengaluru', 'Mumbai', 'Delhi', 'Gurugram', 'Pune', 'Goa']) {
      expect(normaliseCity(city)).toBe(city);
      expect(normaliseCity(normaliseCity(city))).toBe(city);
    }
  });

  it('title-cases unknown cities instead of dropping them', () => {
    expect(normaliseCity('nashik')).toBe('Nashik');
    expect(normaliseCity('NAVI MUMBAI')).toBe('Navi Mumbai');
  });

  it('does not collapse Navi Mumbai into Mumbai', () => {
    expect(normaliseCity('Navi Mumbai')).not.toBe('Mumbai');
  });

  it('returns null for empty input', () => {
    expect(normaliseCity(null)).toBeNull();
    expect(normaliseCity(undefined)).toBeNull();
    expect(normaliseCity('   ')).toBeNull();
  });
});

describe('isHomeCity', () => {
  it('recognises every spelling of the home city', () => {
    expect(HOME_CITY).toBe('Bengaluru');
    expect(isHomeCity('Bangalore')).toBe(true);
    expect(isHomeCity('bengaluru')).toBe(true);
    expect(isHomeCity('Mumbai')).toBe(false);
    expect(isHomeCity(null)).toBe(false);
  });
});
