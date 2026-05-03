import { describe, it, expect } from 'vitest';
import { loadTemplates } from '../../src/templates/loader.js';

describe('loadTemplates', () => {
  it('loads all templates from the repo templates directory', async () => {
    const templates = await loadTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(3);

    const ids = templates.map(t => t.id).sort();
    expect(ids).toContain('unwind_release_pressure_01');
    expect(ids).toContain('attract_amsterdam_morning_01');
    expect(ids).toContain('lockin_one_rep_01');
  });

  it('rejects malformed templates', async () => {
    await expect(loadTemplates({ rootDir: '/nonexistent' })).rejects.toThrow();
  });
});
