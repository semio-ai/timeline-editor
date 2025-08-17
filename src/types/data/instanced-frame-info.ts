import { RawValue, RawVector2 } from "@semio/utils";

/**
 * A frame of data that is associated with a set of possible tracks
 * @param id - A unique identifier for the frame
 * @param stamp - The timestamp of the frame
 * @param points - An array of points that are associated with the frame
 * @param transitions - An object that contains the transition information for the frame
 *
 * Note: The transitions in to this frame use the space in the previous gap, whereas the transitions out of this frame use the space in the next gap.
 * Thus, a transition in with ease-in-out-cubic would be {x: 35, y: 1}, and a transition out with ease-in-out-cubic would be {x: 65, y: 1}
 */
export interface InstancedFrameInfo {
  id: string;
  stamp: number;
  points: { id: string; value: RawValue; trackId: string }[];
  transitions?: {
    in?: RawVector2;
    out?: RawVector2;
  };
}
