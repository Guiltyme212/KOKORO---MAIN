export type Mode = 'soft' | 'sharp';

export type ContentType = 'unwind' | 'attract' | 'lockin';

export type VoiceId = 'mira' | 'brad' | 'aiko' | 'sage';

/**
 * Five tonal vibes the user picks instead of (content type × voice). Drives
 * the visual treatment of the mode-select screen and is mapped client-side
 * to the legacy backend triple `{contentType, mode, voiceId}`.
 */
export type Vibe = 'raw' | 'cosmic' | 'iron' | 'zen' | 'sleep';

export type VibeBackendMapping = {
  contentType: ContentType;
  mode: Mode;
  voiceId: VoiceId;
};

export const VIBE_TO_BACKEND: Record<Vibe, VibeBackendMapping> = {
  raw:    { contentType: 'lockin',  mode: 'sharp', voiceId: 'brad' },
  cosmic: { contentType: 'attract', mode: 'soft',  voiceId: 'aiko' },
  iron:   { contentType: 'lockin',  mode: 'sharp', voiceId: 'brad' },
  zen:    { contentType: 'unwind',  mode: 'soft',  voiceId: 'sage' },
  sleep:  { contentType: 'unwind',  mode: 'soft',  voiceId: 'mira' },
};

export type Becoming =
  | 'calm'
  | 'sleep'
  | 'focus'
  | 'detachment'
  | 'confidence'
  | 'softness'
  | 'power'
  | 'future'
  | 'action';

export type Answers = {
  callMe: string;
  realName?: string;
  carry: string;
  chips: string[];
  becoming: Becoming | '';
  /** New: single dimension that replaces contentType + voiceId selection. */
  vibe: Vibe | '';
  /** Legacy fields — kept on the type so existing screens still compile. They
   *  are no longer user-set; Composing populates them from `vibe` via
   *  VIBE_TO_BACKEND when sending to the API. */
  contentType: ContentType | '';
  voiceId: VoiceId | '';
  voice: string;
  mode: Mode;
};

export const ANSWERS_DEFAULT: Answers = {
  callMe: '',
  carry: '',
  chips: [],
  becoming: '',
  vibe: '',
  contentType: '',
  voiceId: '',
  voice: '',
  mode: 'soft',
};
