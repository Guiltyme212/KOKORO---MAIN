export type Mode = 'soft' | 'sharp';

export type ContentType = 'unwind' | 'attract' | 'lockin';

export type VoiceId = 'mira' | 'brad' | 'aiko' | 'sage';

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
  contentType: '',
  voiceId: '',
  voice: '',
  mode: 'soft',
};
