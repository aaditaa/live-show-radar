import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatCountdown, formatEta, formatEventDate, formatRelative } from '../lib/time';

const NOW = new Date('2026-10-11T06:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('formatEta', () => {
  it('describes a future instant', () => {
    expect(formatEta(new Date('2026-10-11T08:00:00Z'))).toBe('in 2 h');
    expect(formatEta(new Date('2026-10-11T06:30:00Z'))).toBe('in 30 min');
    expect(formatEta(new Date('2026-10-13T06:00:00Z'))).toBe('in 2 d');
  });

  it('says a past instant is due now rather than "just now"', () => {
    expect(formatEta(new Date('2026-10-11T05:00:00Z'))).toBe('due now');
  });

  it('handles a missing value', () => {
    expect(formatEta(null)).toBe('—');
  });
});

describe('formatRelative', () => {
  it('describes the past', () => {
    expect(formatRelative(new Date('2026-10-11T05:00:00Z'))).toBe('1 h ago');
    expect(formatRelative(new Date('2026-10-11T05:58:00Z'))).toBe('2 min ago');
  });

  it('handles a missing value', () => {
    expect(formatRelative(null)).toBe('never');
  });
});

describe('formatEventDate', () => {
  it('renders a day-precision date in IST without drifting a day', () => {
    const rendered = formatEventDate('2026-12-31', 'day');
    expect(rendered).toContain('31 Dec');
    expect(rendered).toContain('2026');
  });

  it('renders month precision without a day', () => {
    expect(formatEventDate('2026-12-01', 'month')).toBe('December 2026');
  });

  it('reads TBA when there is no date', () => {
    expect(formatEventDate(null)).toBe('TBA');
  });
});

describe('formatCountdown', () => {
  it('counts down to an early-bird deadline', () => {
    expect(formatCountdown(new Date('2026-10-12T06:00:00Z'))).toBe('24 h');
  });

  it('reports a passed deadline as ended', () => {
    expect(formatCountdown(new Date('2026-10-10T06:00:00Z'))).toBe('ended');
  });
});
