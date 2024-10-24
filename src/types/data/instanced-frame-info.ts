import { RawValue } from "@semio/utils";

export interface InstancedFrameInfo {
  id: string;
  stamp: number;
  points: { id: string; value: RawValue; trackId: string }[];
}
