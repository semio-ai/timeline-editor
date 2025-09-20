import { AnimationInstance } from "./animation";

export interface Namespace {
  id: string;
  name: string;
  animationInstances: Record<string, AnimationInstance>;
}
