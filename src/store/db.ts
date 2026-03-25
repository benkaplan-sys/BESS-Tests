import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SavedConfig, SavedResult } from '@/core/types';

interface BESSSchema extends DBSchema {
  configurations: {
    key: string;
    value: SavedConfig;
    indexes: {
      'by-name': string;
      'by-createdAt': string;
    };
  };
  results: {
    key: string;
    value: SavedResult;
    indexes: {
      'by-configId': string;
      'by-createdAt': string;
    };
  };
}

const DB_NAME = 'bess-ercot-model';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BESSSchema>> | null = null;
let dbName = DB_NAME;

function createDb(name: string): Promise<IDBPDatabase<BESSSchema>> {
  return openDB<BESSSchema>(name, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('configurations')) {
        const configStore = db.createObjectStore('configurations', { keyPath: 'id' });
        configStore.createIndex('by-name', 'name');
        configStore.createIndex('by-createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('results')) {
        const resultStore = db.createObjectStore('results', { keyPath: 'id' });
        resultStore.createIndex('by-configId', 'configId');
        resultStore.createIndex('by-createdAt', 'createdAt');
      }
    },
  });
}

export function getDb(): Promise<IDBPDatabase<BESSSchema>> {
  if (!dbPromise) {
    dbPromise = createDb(dbName);
  }
  return dbPromise;
}

/** Reset the db instance with a fresh unique name (used in tests for isolation) */
export function resetDb(): void {
  dbPromise = null;
  dbName = `${DB_NAME}-test-${Math.random().toString(36).slice(2)}`;
}
