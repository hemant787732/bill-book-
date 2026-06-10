import { LocalDatabase } from './dbTypes';
import { supabase } from './supabase';
import { TABLES, sanitizeRow, upsertRows } from './sync';

type SyncCallback = () => void;

interface RealtimePayload {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
  errors: string[];
}

const activeChannels: any[] = [];
let onChangeCallback: SyncCallback | null = null;
let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

function debouncedRefresh() {
  if (refreshTimeout) clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(() => {
    refreshTimeout = null;
    if (onChangeCallback) onChangeCallback();
  }, 500);
}

export function setRealtimeSyncCallback(callback: SyncCallback) {
  onChangeCallback = callback;
}

async function handleInsert(db: LocalDatabase, table: string, payload: RealtimePayload) {
  try {
    const row = sanitizeRow(table, payload.new);
    if (!row?.id) return;
    const pending = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM "${table}" WHERE id = ? AND sync_status = 'pending'`,
      [row.id],
    );
    if (pending.length > 0) return;
    await upsertRows(db, table, [row], 'id');
    debouncedRefresh();
  } catch (err) {
    console.warn(`realtime insert ${table}:`, err);
  }
}

async function handleUpdate(db: LocalDatabase, table: string, payload: RealtimePayload) {
  try {
    const row = sanitizeRow(table, payload.new);
    if (!row?.id) return;
    const pending = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM "${table}" WHERE id = ? AND sync_status = 'pending'`,
      [row.id],
    );
    if (pending.length > 0) return;
    await upsertRows(db, table, [row], 'id');
    debouncedRefresh();
  } catch (err) {
    console.warn(`realtime update ${table}:`, err);
  }
}

async function handleDelete(db: LocalDatabase, table: string, payload: RealtimePayload) {
  try {
    const oldId = payload.old?.id as string | undefined;
    if (!oldId) return;
    const pending = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM "${table}" WHERE id = ? AND sync_status = 'pending'`,
      [oldId],
    );
    if (pending.length > 0) return;
    await db.runAsync(`DELETE FROM "${table}" WHERE id = ?`, [oldId]);
    debouncedRefresh();
  } catch (err) {
    console.warn(`realtime delete ${table}:`, err);
  }
}

export function startRealtimeSync(db: LocalDatabase) {
  if (!supabase || isRunning) return;
  isRunning = true;

  for (const table of TABLES) {
    const channel = supabase.channel(`public:${table}`);

    channel.on(
      'postgres_changes' as any,
      { event: 'INSERT' as any, schema: 'public', table },
      (payload: RealtimePayload) => { void handleInsert(db, table, payload); },
    );

    channel.on(
      'postgres_changes' as any,
      { event: 'UPDATE' as any, schema: 'public', table },
      (payload: RealtimePayload) => { void handleUpdate(db, table, payload); },
    );

    channel.on(
      'postgres_changes' as any,
      { event: 'DELETE' as any, schema: 'public', table },
      (payload: RealtimePayload) => { void handleDelete(db, table, payload); },
    );

    channel.subscribe((status: string) => {
      console.log(`Realtime channel public:${table} status:`, status);
    });
    activeChannels.push(channel);
  }
}

export function stopRealtimeSync() {
  isRunning = false;
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }
  for (const channel of activeChannels) {
    supabase?.removeChannel(channel);
  }
  activeChannels.length = 0;
}
