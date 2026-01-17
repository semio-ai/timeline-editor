import { SemanticTime } from "./semantic-time";

/**
 * An instance in time that has been highlighted in the UI.
 * @param stamp - The timestamp of the preview.
 * @param semanticTime - The semantic time (e.g. type) of the preview.
 */
export interface Preview {
  stamp: number;
  semanticTime: SemanticTime;
}
