export type ActionKey = { rule_id: string; action_class: string };

const key = (value: ActionKey) => `${value.rule_id}\u0000${value.action_class}`;

export function wilson(successes: number, total: number, z = 1.959963984540054) {
  if (total === 0) return [null, null] as const;
  const p = successes / total;
  const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator;
  return [center - margin, center + margin] as const;
}

export function scoreActions(expected: ActionKey[], actual: ActionKey[]) {
  const expectedSet = new Set(expected.map(key));
  const actualSet = new Set(actual.map(key));
  const tp = [...actualSet].filter((value) => expectedSet.has(value)).length;
  const fp = [...actualSet].filter((value) => !expectedSet.has(value)).length;
  const fn = [...expectedSet].filter((value) => !actualSet.has(value)).length;
  const precisionN = tp + fp;
  const recallN = tp + fn;
  const precision = precisionN ? tp / precisionN : null;
  const recall = recallN ? tp / recallN : null;
  return { tp, fp, fn, exact: fp === 0 && fn === 0,
    precision: { n: tp, N: precisionN, rate: precision, wilson95: wilson(tp, precisionN) },
    recall: { n: tp, N: recallN, rate: recall, wilson95: wilson(tp, recallN) } };
}
