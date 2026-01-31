export interface Keyframe {
  id: string;
  time: number;
  imageUrl: string;
  isSketch: boolean;
  originalUrl: string;
  caption?: string;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  READY = 'READY',
}
