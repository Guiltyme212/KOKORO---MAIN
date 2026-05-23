export type AudioPlayerStatus = {
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  didEnd: boolean;
};

export interface AudioPlayerPort {
  load(uri: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionSec: number): Promise<void>;
  unload(): Promise<void>;
  subscribe(listener: (status: AudioPlayerStatus) => void): () => void;
}
