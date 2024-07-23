import { createContext } from "react";
import type { AnimationStore } from "./store";

// This creates a context where the single app store is stored.
export const AnimationContext = createContext<AnimationStore | null>(null);
