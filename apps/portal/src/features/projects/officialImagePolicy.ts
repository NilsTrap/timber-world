export function nextOfficialImagePosition(positions: Array<number | null>): number | null {
  const used = new Set(positions.map(Number));
  return [1, 2, 3].find((candidate) => !used.has(candidate)) ?? null;
}
