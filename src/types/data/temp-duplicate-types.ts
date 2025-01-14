/**
 * Links the animatable to the track.
 * @param id - a unique identifier for the control.
 * @param readId - the id of the animatable that this control reads from.
 * @param writeId - the id of the track that this control writes to.
 * @param settings - the settings for the control.
 */
export interface Control {
  id: string;
  readId: string;
  writeId: string;
  settings: {
    color?: string;
  };
}

/**
 * The type of process that the node represents.
 * @param Identity - a process that does nothing to the input and returns it as the output.
 */
export enum ProcessType {
  Identity = "identity",
}
