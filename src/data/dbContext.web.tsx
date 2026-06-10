import React, { createContext, useContext, useEffect, useState } from 'react';
import { LocalDatabase } from './dbTypes';
import { initDatabase } from './database';

const DatabaseContext = createContext<LocalDatabase | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<LocalDatabase | null>(null);

  useEffect(() => {
    async function setup() {
      const database = await initDatabase();
      setDb(database);
    }
    setup();
  }, []);

  if (!db) return null;

  return (
    <DatabaseContext.Provider value={db}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const db = useContext(DatabaseContext);
  if (!db) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return db;
}
