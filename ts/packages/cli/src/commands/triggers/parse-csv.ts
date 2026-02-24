export const parseCsv = (value: string): ReadonlyArray<string> =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
