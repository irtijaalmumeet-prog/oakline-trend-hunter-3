// Rank product ideas: reward demand, penalise heavy competition. Score /10.
export function scoreIdeas(products = []) {
  return products
    .map((p) => {
      const demand = clamp(Number(p.demandScore ?? 50), 0, 100);
      const comp = clamp(Number(p.competitionScore ?? 50), 0, 100);
      const score = Math.round(((demand * 0.7 + (100 - comp) * 0.3) / 10) * 10) / 10;
      return { ...p, demandScore: demand, competitionScore: comp, finalScore: score };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}
function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }
