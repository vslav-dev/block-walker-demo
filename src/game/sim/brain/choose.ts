// The index of the score that is picked by chance, a higher score more likely. The weight of a score is exp(score / temperature):
// with a high temperature all are about as likely, with a low one the highest nearly always wins. It is the difference between
// scores that matters, not their size, so a score far above the others (a pressing need) leaves them next to no chance.
export function pickWeighted(scores: readonly number[], temperature: number, rand: () => number): number {
  const best = Math.max(...scores);
  const weights = scores.map((score) => Math.exp((score - best) / temperature));
  let left = rand() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < weights.length; i++) {
    left -= weights[i];
    if (left < 0) return i;
  }
  return weights.length - 1; // rounding
}
