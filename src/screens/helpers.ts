export function includesSearch(values: any[], search: string): boolean {
  const cleanSearch = search.toLowerCase().trim();
  if (!cleanSearch) return true;
  return values.some(v => String(v ?? '').toLowerCase().includes(cleanSearch));
}

export function dateInputToIso(input: string): string {
  if (!input) return '';
  const [d, m, y] = input.split('/');
  if (!d || !m || !y) return input;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}
