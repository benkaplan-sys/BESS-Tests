import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { resetDb } from '@/store/db';
import { saveConfig, getConfigById, listConfigs, deleteConfig, updateConfig } from '@/store/configStore';
import { CANONICAL_CONFIG } from '../fixtures/validInputs';

beforeEach(() => {
  resetDb();
});

describe('configStore', () => {
  it('saves and retrieves a config by ID', async () => {
    const id = await saveConfig(CANONICAL_CONFIG, 'Test Config', 'A test description');
    const retrieved = await getConfigById(id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('Test Config');
    expect(retrieved?.description).toBe('A test description');
    expect(retrieved?.config.baseSeed).toBe(CANONICAL_CONFIG.baseSeed);
  });

  it('migrates old config (scalar TransitionMatrix) on load', async () => {
    const db = await (await import('@/store/db')).getDb();
    // Simulate an old-format config with scalar transition probs
    const oldConfig = {
      ...CANONICAL_CONFIG,
      years: CANONICAL_CONFIG.years.map((y) => ({
        ...y,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        summer: { pNormalToHigh: 0.05, pHighToNormal: 0.3 } as any, // OLD scalar format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        other:  { pNormalToHigh: 0.02, pHighToNormal: 0.4 } as any,
      })),
    };
    const id = 'migration-test-id';
    await db.add('configurations', {
      id, name: 'Old Config', createdAt: '2024-01-01T00:00:00.000Z-000000',
      updatedAt: '2024-01-01T00:00:00.000Z', config: oldConfig,
    });
    const retrieved = await getConfigById(id);
    expect(Array.isArray(retrieved?.config.years[0]?.summer.pNormalToHigh)).toBe(true);
    expect(retrieved?.config.years[0]?.summer.pNormalToHigh).toHaveLength(10);
  });

  it('lists saved configs as summaries', async () => {
    await saveConfig(CANONICAL_CONFIG, 'Config A');
    await saveConfig({ ...CANONICAL_CONFIG, baseSeed: 1 }, 'Config B');
    const list = await listConfigs();
    expect(list.length).toBe(2);
    expect(list.every((c) => c.id && c.name && c.createdAt)).toBe(true);
  });

  it('deletes a config', async () => {
    const id = await saveConfig(CANONICAL_CONFIG, 'To Delete');
    await deleteConfig(id);
    expect(await getConfigById(id)).toBeNull();
  });

  it('updates config name', async () => {
    const id = await saveConfig(CANONICAL_CONFIG, 'Original');
    await updateConfig(id, { name: 'Updated' });
    expect((await getConfigById(id))?.name).toBe('Updated');
  });

  it('returns newest configs first in list', async () => {
    await saveConfig(CANONICAL_CONFIG, 'First');
    await saveConfig(CANONICAL_CONFIG, 'Second');
    const list = await listConfigs();
    expect(list[0]?.name).toBe('Second');
    expect(list[1]?.name).toBe('First');
  });
});
