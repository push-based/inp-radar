import { describe, expect, it } from 'vitest';

import { rate } from './protocol';

describe('rate', () => {
  it.each([
    [0, 'good'],
    [200, 'good'],
    [200.1, 'needs-improvement'],
    [500, 'needs-improvement'],
    [500.1, 'poor'],
    [10_000, 'poor'],
  ])('rates %d ms as %s', (value, rating) => {
    expect(rate(value)).toBe(rating);
  });
});
