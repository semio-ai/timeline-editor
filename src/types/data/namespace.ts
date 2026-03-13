import { AnimationInstance } from "./animation";

export interface Namespace {
  /** Namespace id (stable key for grouping instances). */
  id: string;
  /** Human-readable namespace label. */
  name: string;
  /** Instances keyed by instance id. */
  animationInstances: Record<string, AnimationInstance>;
}
