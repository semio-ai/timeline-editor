import type { ReactNode } from "react";
import { useContext, memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { AnimationContext } from "./context";
import { useDefaultAnimationStore } from "./store";
import { useAnimationStore } from "./hooks/use-animation-store";
import { Controls } from "./controls";

export function AnimationSheet(): ReactNode {
  const ctx = useContext(AnimationContext);
  if (ctx) {
    return <MemoizedInnerSheet />;
  } else {
    return (
      <AnimationContext.Provider value={useDefaultAnimationStore}>
        <MemoizedInnerSheet />
      </AnimationContext.Provider>
    );
  }
}

export function InnerSheet(): ReactNode {
  const [expanded, setExpanded] = useAnimationStore(
    useShallow((state) => [state.expanded, state.setExpanded]),
  );
  return (
    <div
      className={`dark:bg-neutral-800 bg-neutral-200 transition-all duration-75 ${expanded && "h-48"}`}
    >
      InnerSheet
      <Controls />
    </div>
  );
}

const MemoizedInnerSheet = memo(InnerSheet);
