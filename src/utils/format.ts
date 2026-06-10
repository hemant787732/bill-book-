export function createId(prefix: string = ''): string {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
}

export function parseAmount(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

export function formatMoney(amount: number | string): string {
  const num = parseAmount(amount);
  return num.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}

export function formatPlainNumber(num: number | string): string {
  if (typeof num === 'string' && !num.trim()) return '';
  const n = typeof num === 'string' ? parseFloat(num) || 0 : num;
  if (isNaN(n) || n === 0) return '';
  return String(Math.round(n * 100) / 100);
}

export function localIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDateForBill(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}
