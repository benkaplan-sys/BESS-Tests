import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';
import { SavedResult, SimulationConfig, SimulationResult } from '@/core/types';

export interface ResultSummary {
  id: string;
  configId: string;
  configHash: string;
  createdAt: string;
  configName?: string;
}

export async function saveResult(
  configId: string,
  configSnapshot: SimulationConfig,
  configHash: string,
  result: SimulationResult
): Promise<string> {
  const db = await getDb();
  const id = uuidv4();
  const saved: SavedResult = {
    id,
    configId,
    configSnapshot,
    configHash,
    result,
    createdAt: new Date().toISOString(),
  };
  await db.add('results', saved);
  return id;
}

export async function getResultById(id: string): Promise<SavedResult | null> {
  const db = await getDb();
  return (await db.get('results', id)) ?? null;
}

export async function getResultByConfigId(configId: string): Promise<SavedResult | null> {
  const db = await getDb();
  const results = await db.getAllFromIndex('results', 'by-configId', configId);
  return results[results.length - 1] ?? null;
}

export async function listResults(): Promise<ResultSummary[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('results', 'by-createdAt');
  return all
    .map((r) => ({
      id: r.id,
      configId: r.configId,
      configHash: r.configHash,
      createdAt: r.createdAt,
    }))
    .reverse();
}

export async function deleteResult(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('results', id);
}
