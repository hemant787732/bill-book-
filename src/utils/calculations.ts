import { BillItemDraft, LabourType, MetalType } from '../types';
import { parseAmount } from './format';

export type MetalRates = {
  gold10gRate?: number;
  silver1kgRate: number;
};

export function calculateNetWeight(weight: string, packetLess: string): number {
  return Math.max(0, parseAmount(weight) - parseAmount(packetLess));
}

// A blank/whitespace touch is treated as 100% purity. An explicitly entered 0
// stays 0 — only an empty value defaults.
export function resolveTouch(touch: string | number | undefined | null): number {
  if (touch === undefined || touch === null) return 100;
  if (typeof touch === 'string' && touch.trim() === '') return 100;
  return parseAmount(touch);
}

export function calculateTotalFine(items: any[]): number {
  return items.reduce((sum, item) => {
    const w = typeof item.weight === 'string' ? parseAmount(item.weight) : (item.weight || 0);
    const t = resolveTouch(item.touch);
    const p = typeof item.packetLess === 'string' ? parseAmount(item.packetLess) : (item.packetLess || 0);
    const netWeight = Math.max(0, w - p);
    return sum + roundWeight((netWeight * t) / 100);
  }, 0);
}

export function calculateReceivedFine(weight: string | number, touch: string | number): number {
  return roundWeight((parseAmount(weight) * resolveTouch(touch)) / 100);
}

export function calculateLabourCharge(item: BillItemDraft): number {
  const netWeight = calculateNetWeight(item.weight, item.packetLess);
  const lab = parseAmount(item.labour);
  if (item.labourType === 'pcs') {
    return lab * parseAmount(item.pcs);
  }
  return lab * netWeight;
}

export function calculateLabourCharges(weight: number, labour: string, labourType: LabourType, pcs: string): number {
  const lab = parseAmount(labour);
  if (labourType === 'pcs') {
    return lab * parseAmount(pcs);
  }
  return lab * weight;
}

export function getMetalRatePerGram(_material: MetalType, rates: MetalRates): number {
  return rates.silver1kgRate / 1000;
}

export function getMetalRateUnit(_material: MetalType, rates: MetalRates): number {
  return rates.silver1kgRate;
}

export function calculateSubtotal(items: BillItemDraft[], rates?: MetalRates): number {
  return items.reduce((total, item) => {
    const amount = parseAmount(item.amount);
    return total + amount;
  }, 0);
}

export function calculateNetTotal(subtotal: number, receivedValue: number, discount: number): number {
  return subtotal - receivedValue - discount;
}

export function roundFineToHalfGram(fine: number): number {
  return Math.round(fine * 2) / 2;
}

export function roundWeight(value: number): number {
  const frac = value - Math.floor(value);
  if (frac < 0.11) return Math.floor(value);
  if (frac < 0.6) return Math.round(value * 2) / 2;
  return Math.ceil(value);
}

export function formatCalcValue(val: number | string, decimals: number = 2): string {
  const num = typeof val === 'string' ? parseAmount(val) : val;
  if (num === 0) return '';
  return num.toFixed(decimals);
}

export function autoCalculateItem(item: BillItemDraft, rates: MetalRates): BillItemDraft {
  let weight = parseAmount(item.weight);
  let packetLess = parseAmount(item.packetLess);
  if (weight > 0) weight = roundWeight(weight);
  if (packetLess > 0) packetLess = roundWeight(packetLess);
  const netWeight = Math.max(0, weight - packetLess);
  const touch = resolveTouch(item.touch);
  const fine = roundWeight((netWeight * touch) / 100);
  
  const ratePerGram = item.rate ? parseAmount(item.rate) / 1000 : getMetalRatePerGram(item.material, rates);
  const metalValue = netWeight * ratePerGram;
  const labour = calculateLabourCharges(netWeight, item.labour, item.labourType, item.pcs);
  const otherCharge = parseAmount(item.other);
  const total = metalValue + labour + otherCharge;

  return {
    ...item,
    weight: weight.toString(),
    fine: fine.toFixed(3),
    amount: Math.round(total).toString(),
  };
}
