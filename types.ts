export interface Window {
  Hands: any;
  Camera: any;
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandResults {
  multiHandLandmarks: HandLandmark[][];
  multiHandedness: any[];
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export interface Beat {
  id: string;
  x: number;
  y: number;
  z: number;
  color: string;
  hit: boolean;
  lane: number; // 0-2 (Left, Center, Right) or randomized
}

export interface LevelTheme {
  name: string;
  colors: string[]; // [Primary, Secondary, Background, Grid]
  speedMultiplier: number; // 1.0 to 2.0
  description: string;
}
