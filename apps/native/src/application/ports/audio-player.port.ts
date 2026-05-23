export type AudioPlayerStatus = {
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  didEnd: boolean;
};

export type AudioMeta = {
  title?: string;
  artist?: string;
  artworkUrl?: string;
};

export interface AudioPlayerPort {
  load(uri: string, meta?: AudioMeta): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionSec: number): Promise<void>;
  setPlaybackRate(rate: number): Promise<void>;
  unload(): Promise<void>;
  subscribe(listener: (status: AudioPlayerStatus) => void): () => void;
}
