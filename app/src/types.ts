/**
 * Five tonal vibes the user picks. Each maps 1:1 to a backend Template
 * (api/templates/vibe_*_01.json) which carries the reference transcript +
 * audio used to steer the generated meditation.
 */
export type Vibe = 'raw' | 'cosmic' | 'iron' | 'zen' | 'sleep';

export type Answers = {
  callMe: string;
  realName?: string;
  carry: string;
  chips: string[];
  vibe: Vibe | '';
};

export const ANSWERS_DEFAULT: Answers = {
  callMe: '',
  carry: '',
  chips: [],
  vibe: '',
};
