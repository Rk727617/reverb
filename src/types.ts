/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  speed: number;
  reverb: number;
  pitch: number;
  bass: number;
  fileName: string | null;
}

export const INITIAL_STATE: AudioState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  speed: 1,
  reverb: 0,
  pitch: 0,
  bass: 0,
  fileName: null,
};

export interface Preset {
  name: string;
  speed: number;
  reverb: number;
  pitch: number;
  bass: number;
}

export const PRESETS: Preset[] = [
  { name: "Slowed + Reverb", speed: 0.85, reverb: 0.6, pitch: -2, bass: 5 },
  { name: "Nightcore", speed: 1.25, reverb: 0.1, pitch: 2, bass: 2 },
  { name: "Deep Bass", speed: 1.0, reverb: 0.2, pitch: 0, bass: 12 },
  { name: "Chill Reverb", speed: 0.9, reverb: 0.8, pitch: -1, bass: 3 },
];
