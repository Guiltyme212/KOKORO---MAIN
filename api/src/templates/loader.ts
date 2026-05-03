import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { Template } from '../types.js';

const TemplateSchema = z.object({
  id: z.string(),
  contentType: z.enum(['unwind', 'attract', 'lockin']),
  modes: z.array(z.enum(['soft', 'sharp'])).min(1),
  becomingMatch: z.array(z.string()),
  themeKeywords: z.array(z.string()),
  targetDurationSec: z.number().int().positive(),
  musicStylePrompt: z.string().min(10),
  referenceTrackUrls: z.array(z.string().url()).max(2),
  structure: z.array(z.object({
    id: z.string(),
    sec: z.number().int().positive(),
    intent: z.string(),
  })).min(3),
  registerNotes: z.object({ soft: z.string(), sharp: z.string() }),
});

export async function loadTemplates(opts?: { rootDir?: string }): Promise<Template[]> {
  const rootDir = opts?.rootDir ?? join(process.cwd(), '..', 'templates');
  const subdirs = ['unwind', 'attract', 'lockin'];
  const out: Template[] = [];

  for (const sub of subdirs) {
    const dir = join(rootDir, sub);
    const files = await readdir(dir);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const raw = await readFile(join(dir, f), 'utf8');
      const parsed = TemplateSchema.parse(JSON.parse(raw));
      out.push(parsed);
    }
  }

  return out;
}
