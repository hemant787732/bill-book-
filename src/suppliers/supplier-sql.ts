import { LocalDatabase } from '../data/dbTypes';
import { SupplierAccount } from '../types';

export async function saveSupplierManualEntry(db: LocalDatabase, supplier: SupplierAccount) {
  return supplier;
}
