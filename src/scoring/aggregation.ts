interface ProviderScore {
  category: string;
  score: number;
}

// Unrounded on purpose: rounding happens only at display
export function computeCategoryScores(
  providerScores: ProviderScore[]
): Record<string, number> {
  const categoryGroups = new Map<string, number[]>();

  for (const { category, score } of providerScores) {
    const scores = categoryGroups.get(category) ?? [];
    scores.push(score);
    categoryGroups.set(category, scores);
  }

  const result: Record<string, number> = {};
  for (const [category, scores] of categoryGroups) {
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    result[category] = avg;
  }

  return result;
}

export function computeGlobalIndex(
  categoryScores: Record<string, number>
): number {
  const values = Object.values(categoryScores);
  if (values.length === 0) return 100;
  const avg = values.reduce((sum, s) => sum + s, 0) / values.length;
  return avg;
}
