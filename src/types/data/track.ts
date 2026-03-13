import { RawValue } from "@semio/utils";
import { Keypoint } from "./keypoint";

/**
 * Runtime track definition holding keypoints for a single animatable channel.
 * Composite animatables are flattened into multiple scalar tracks.
 */
export interface Track<DataType extends RawValue> {
  /** Unique track id. */
  id: string;
  /** Human-readable track name. */
  name: string;
  /**
   * Optional label to use when grouping derived component tracks under a parent.
   */
  groupName?: string;
  /** Ordered keypoints for this track. */
  points: Keypoint<DataType>[];
  /** Owning animatable id. */
  animatableId: string;
  /** Runtime-only settings attached to this track. */
  settings?: {
    /** Optional display color. */
    color?: string;
    /** Whether this track is muted from playback. */
    muted?: boolean;
  };
}

/**
 * Stored track shape used for persistence.
 * Omits runtime-only settings such as `muted`.
 */
export interface StoredTrack<DataType extends RawValue> {
  /** Unique track id. */
  id: string;
  /** Human-readable track name. */
  name: string;
  /** Optional label to use when grouping derived component tracks under a parent. */
  groupName?: string;
  /** Ordered keypoints for this track. */
  points: Keypoint<DataType>[];
  /** Owning animatable id. */
  animatableId: string;
  /** Persisted track settings. */
  settings?: {
    /** Optional display color. */
    color?: string;
  };
}
