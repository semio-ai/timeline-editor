import * as THREE from "three";
import type { Color } from "three";

// Color palette for datapoints (can be expanded or customized)
export const PALETTE: (string | Color)[] = [
  "#fb2c36",
  "#ff6900",
  "#f0b100",
  "#00c950",
  "#0084d1",
  "#8e51ff",
  new THREE.Color("rgb(246, 51, 154)"),
];

export const DEFAULT_DATAPOINTS = [
  { id: "0", x: 0.0, y: 0, color: PALETTE[1] },
  { id: "1", x: 0.1, y: 0, color: PALETTE[0] },
  { id: "2", x: 0.125, y: 0, color: PALETTE[4] },
  { id: "3", x: 0.14, y: 0, color: PALETTE[2] },
  { id: "4", x: 0.15, y: 0, color: PALETTE[6] },
  { id: "5", x: 0.16, y: 0, color: PALETTE[4] },
  { id: "6", x: 0.2, y: 0, color: PALETTE[3] },
  { id: "7", x: 0.3, y: 0, color: PALETTE[5] },
  { id: "8", x: 0.4, y: 0, color: PALETTE[2] },
  { id: "9", x: 0.9, y: 0, color: PALETTE[1] },
];
