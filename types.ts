export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export enum AppMode {
  TEXT = 'TEXT',
  VOICE = 'VOICE'
}

export interface AudioVisualizerState {
  volume: number;
  isPlaying: boolean;
}