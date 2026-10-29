import { RawValue } from "@semio/data";
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
  /**
   * Owning animatable id. For a track on an input an entity's runtime
   * declares beyond its model ({@link inputKey}), the id Studio shows that
   * input under, `runtimeInputId(inputKey)` (`@semio/data`).
   */
  animatableId: string;
  /** See {@link StoredTrack.inputKey}. */
  inputKey?: string;
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
  /**
   * Owning animatable id. For a track with an {@link inputKey}, the id Studio
   * shows that input under, `runtimeInputId(inputKey)` (`@semio/data`):
   * a reader that does not know `inputKey` sees a track on an animatable the
   * model lacks, which it leaves unplayed, as it does a track whose
   * animatable a model update removed.
   */
  animatableId: string;
  /**
   * The input the track animates when it is none of the model's animatables:
   * its key, as the entity's runtime declares it open (an Arora key path,
   * `fan.target_value`). It plays on an entity whose runtime declares that
   * key, and nowhere else. Absent for a track on an animatable.
   */
  inputKey?: string;
  /** Persisted track settings. */
  settings?: {
    /** Optional display color. */
    color?: string;
  };
}
