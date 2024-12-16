import { RawValue } from "@semio/utils";

/**
 * A frame of data that is associated with a set of possible tracks
 * @param id - A unique identifier for the frame
 * @param stamp - The timestamp of the frame
 * @param points - An array of points that are associated with the frame
 */
export interface InstancedFrameInfo {
  id: string;
  stamp: number;
  points: { id: string; value: RawValue; trackId: string }[];
}
