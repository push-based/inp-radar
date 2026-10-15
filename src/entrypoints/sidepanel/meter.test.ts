import { describe, expect, it } from 'vitest';

import { SPEED, lagDegrees } from './meter';

describe('lagDegrees', () => {
  it('scales lag to a share of one sweep', () => {
    expect(lagDegrees(SPEED / 4)).toBe(90);
    expect(lagDegrees(SPEED)).toBe(360);
  });

  it('keeps a minimum wedge so a healthy page still shows one', () => {
    expect(lagDegrees(0)).toBe(10);
    expect(lagDegrees(16)).toBe(10);
  });
});
