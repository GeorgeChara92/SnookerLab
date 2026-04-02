export const calculatePercentage = (score: number, max: number) => max > 0 ? Math.round((score / max) * 100) : 0;
