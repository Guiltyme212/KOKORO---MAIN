import { describe, it, expect } from 'vitest';
import { selectTemplate } from '../../src/pipeline/selectTemplate.js';
import type { Template } from '../../src/types.js';

const fixtures: Template[] = [
  {
    id: 'unwind_a', contentType: 'unwind', modes: ['soft','sharp'],
    becomingMatch: ['calm','softness'], themeKeywords: ['pressure','tired'],
    targetDurationSec: 360, musicStylePrompt: 'warm ambient',
    referenceTrackUrls: [], structure: [{id:'a',sec:60,intent:'x'}],
    registerNotes: { soft: 's', sharp: 's' },
  },
  {
    id: 'attract_a', contentType: 'attract', modes: ['soft','sharp'],
    becomingMatch: ['future','confidence'], themeKeywords: ['amsterdam','morning'],
    targetDurationSec: 420, musicStylePrompt: 'cinematic',
    referenceTrackUrls: [], structure: [{id:'a',sec:60,intent:'x'}],
    registerNotes: { soft: 's', sharp: 's' },
  },
];

describe('selectTemplate', () => {
  it('picks by contentType first', () => {
    const t = selectTemplate(fixtures, {
      contentType: 'attract', mode: 'soft', themeText: 'random', becoming: 'calm',
    });
    expect(t.id).toBe('attract_a');
  });

  it('breaks ties by themeKeyword overlap', () => {
    const more: Template[] = [
      ...fixtures,
      { ...fixtures[0]!, id: 'unwind_b', themeKeywords: ['amsterdam'] },
    ];
    const t = selectTemplate(more, {
      contentType: 'unwind', mode: 'soft', themeText: 'pressure tired', becoming: 'calm',
    });
    expect(t.id).toBe('unwind_a');     // beats unwind_b on keywords
  });

  it('falls back to becomingMatch when no keyword overlap', () => {
    const t = selectTemplate(fixtures, {
      contentType: 'unwind', mode: 'soft', themeText: 'gibberish nothing', becoming: 'softness',
    });
    expect(t.id).toBe('unwind_a');
  });

  it('throws if no template matches contentType', () => {
    expect(() => selectTemplate(fixtures, {
      contentType: 'lockin', mode: 'soft', themeText: '', becoming: 'calm',
    })).toThrow(/no template/i);
  });
});
