import { describe, expect, it } from 'vitest';
import { dayLoss, lossLevel, normalCeiling } from '@/data/service-grid';

describe('grid colouring', () => {
  it('averages the points each service lost', () => {
    expect(dayLoss([100, 90, 80])).toBe(10);
    expect(dayLoss([])).toBe(0);
  });

  it("puts normal at the row's 75th percentile, never below the floor", () => {
    expect(normalCeiling([0, 1, 2, 4, 5, 6, 8, 40], 3)).toBe(6);
    expect(normalCeiling([0, 0, 0, 0, 1], 3)).toBe(3);
  });

  it('keeps ordinary days out of the red', () => {
    expect(lossLevel(0, 4)).toBe(0);
    expect(lossLevel(4, 4)).toBe(1);
    expect(lossLevel(5, 4)).toBe(2);
    expect(lossLevel(12, 4)).toBe(3);
    expect(lossLevel(30, 4)).toBe(4);
    expect(lossLevel(40, 4)).toBe(5);
  });
});
