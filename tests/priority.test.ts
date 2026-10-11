import { describe, expect, it } from 'vitest';
import {
  computePriority,
  shouldPush,
  type PriorityInput,
} from '../lib/pipeline/priority';

const NOW = new Date('2026-10-11T00:00:00Z');

function input(overrides: Partial<PriorityInput> = {}): PriorityInput {
  return {
    city: 'Bengaluru',
    confidence: 0.95,
    earlyBirdStatus: 'not_mentioned',
    earlyBirdDeadline: null,
    ...overrides,
  };
}

describe('computePriority', () => {
  it('P0: Bengaluru with early bird open', () => {
    expect(computePriority(input({ earlyBirdStatus: 'open' }), NOW)).toBe('P0');
  });

  it('P0: Bengaluru with early bird imminent', () => {
    expect(computePriority(input({ earlyBirdStatus: 'imminent' }), NOW)).toBe('P0');
  });

  it('P0 recognises Bangalore as Bengaluru', () => {
    expect(computePriority(input({ city: 'Bangalore', earlyBirdStatus: 'open' }), NOW)).toBe('P0');
  });

  it('P1: Bengaluru with no early bird', () => {
    expect(computePriority(input(), NOW)).toBe('P1');
  });

  it('P1: Bengaluru even when the early bird has closed or sold out', () => {
    expect(computePriority(input({ earlyBirdStatus: 'sold_out' }), NOW)).toBe('P1');
    expect(computePriority(input({ earlyBirdStatus: 'closed' }), NOW)).toBe('P1');
  });

  it('P1: another Indian city with early bird open and a deadline inside 72 h', () => {
    expect(
      computePriority(
        {
          city: 'Mumbai',
          confidence: 0.95,
          earlyBirdStatus: 'open',
          earlyBirdDeadline: new Date('2026-10-13T00:00:00Z'),
        },
        NOW,
      ),
    ).toBe('P1');
  });

  it('P2 when that deadline is further out than 72 h', () => {
    expect(
      computePriority(
        {
          city: 'Mumbai',
          confidence: 0.95,
          earlyBirdStatus: 'open',
          earlyBirdDeadline: new Date('2026-10-20T00:00:00Z'),
        },
        NOW,
      ),
    ).toBe('P2');
  });

  it('P2 when the deadline has already passed', () => {
    expect(
      computePriority(
        {
          city: 'Mumbai',
          confidence: 0.95,
          earlyBirdStatus: 'open',
          earlyBirdDeadline: new Date('2026-10-10T00:00:00Z'),
        },
        NOW,
      ),
    ).toBe('P2');
  });

  it('P2: any other Indian city', () => {
    expect(computePriority(input({ city: 'Pune' }), NOW)).toBe('P2');
    expect(computePriority(input({ city: 'Goa', earlyBirdStatus: 'imminent' }), NOW)).toBe('P2');
  });

  it('P3: low confidence outranks everything, even a Bengaluru early bird', () => {
    expect(
      computePriority(input({ confidence: 0.75, earlyBirdStatus: 'open' }), NOW),
    ).toBe('P3');
  });

  it('0.8 is confident enough to leave the P3 band', () => {
    expect(computePriority(input({ confidence: 0.8 }), NOW)).toBe('P1');
    expect(computePriority(input({ confidence: 0.79 }), NOW)).toBe('P3');
  });
});

describe('shouldPush', () => {
  it('pushes everything except P3', () => {
    expect(shouldPush('P0')).toBe(true);
    expect(shouldPush('P1')).toBe(true);
    expect(shouldPush('P2')).toBe(true);
    expect(shouldPush('P3')).toBe(false);
  });
});
