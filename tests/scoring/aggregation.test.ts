import { describe, it, expect } from 'vitest';
import {
  computeCategoryScores,
  computeGlobalIndex,
} from '../../src/scoring/aggregation';

describe('computeCategoryScores', () => {
  it('averages scores within each category', () => {
    const providerScores = [
      { category: 'cloud-infra', score: 90 },
      { category: 'cloud-infra', score: 80 },
      { category: 'ai', score: 70 },
      { category: 'ai', score: 100 },
    ];

    const result = computeCategoryScores(providerScores);

    expect(result['cloud-infra']).toBe(85);
    expect(result['ai']).toBe(85);
  });

  it('handles a single provider in a category', () => {
    const providerScores = [{ category: 'fintech', score: 95 }];

    const result = computeCategoryScores(providerScores);

    expect(result['fintech']).toBe(95);
  });
});

describe('computeGlobalIndex', () => {
  it('averages category scores with equal weight', () => {
    const categoryScores = {
      'cloud-infra': 90,
      ai: 80,
      fintech: 100,
    };

    const result = computeGlobalIndex(categoryScores);
    expect(result).toBe(90);
  });

  it('rounds to nearest integer', () => {
    const categoryScores = {
      'cloud-infra': 91,
      ai: 82,
    };

    const result = computeGlobalIndex(categoryScores);
    expect(result).toBe(87);
  });
});
