import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';
import { SavedConfig, SimulationConfig } from '@/core/types';
import { migrateConfig } from '@/core/migration';

export interface ConfigSummary {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  numTrials: number;
  startYear: number;
}

let _saveCounter = 0;

function monotonicTimestamp(): string {
  const base = new Date().toISOString();
  const seq = String(_saveCounter++).padStart(6, '0');
  return `${base}-${seq}`;
}

export async function saveConfig(
  config: SimulationConfig,
  name: string,
  description?: string
): Promise<string> {
  const db = await getDb();
  const now = monotonicTimestamp();
  const id = uuidv4();
  const saved: SavedConfig = {
    id,
    name,
    description,
    createdAt: now,
    updatedAt: now,
    config: { ...config, id, name },
  };
  await db.add('configurations', saved);
  return id;
}

export async function getConfigById(id: string): Promise<SavedConfig | null> {
  const db = await getDb();
  const raw = await db.get('configurations', id);
  if (!raw) return null;
  // Migrate config to current schema on load
  return { ...raw, config: migrateConfig(raw.config) };
}

export async function listConfigs(): Promise<ConfigSummary[]> {
  const db = await getDb();
  const all = await db.getAll('configurations');
  return all
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      numTrials: c.config.numTrials,
      startYear: c.config.startYear,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteConfig(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('configurations', id);
}

export async function updateConfig(
  id: string,
  partial: Partial<Pick<SavedConfig, 'name' | 'description' | 'config'>>
): Promise<void> {
  const db = await getDb();
  const existing = await db.get('configurations', id);
  if (!existing) throw new Error(`Config ${id} not found`);
  const updated: SavedConfig = {
    ...existing,
    ...partial,
    updatedAt: new Date().toISOString(),
  };
  await db.put('configurations', updated);
}
