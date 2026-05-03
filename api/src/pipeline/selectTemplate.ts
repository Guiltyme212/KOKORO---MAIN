import type { Template } from '../types.js';

export type SelectInput = {
  contentType: 'unwind' | 'attract' | 'lockin';
  mode: 'soft' | 'sharp';
  themeText: string;                   // joined capture text
  becoming?: string;
};

export function selectTemplate(templates: Template[], input: SelectInput): Template {
  const candidates = templates.filter(
    t => t.contentType === input.contentType && t.modes.includes(input.mode),
  );
  if (candidates.length === 0) {
    throw new Error(`no template for contentType=${input.contentType} mode=${input.mode}`);
  }

  const themeWords = new Set(
    input.themeText.toLowerCase().split(/\W+/).filter(Boolean),
  );

  const scored = candidates.map(t => {
    const keywordHits = t.themeKeywords.filter(k => themeWords.has(k.toLowerCase())).length;
    const becomingHit = input.becoming && t.becomingMatch.includes(input.becoming) ? 1 : 0;
    return { template: t, score: keywordHits * 10 + becomingHit };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]!.template;
}
