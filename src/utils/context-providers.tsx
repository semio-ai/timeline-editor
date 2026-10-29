/**
 * Standard interface for components that might need animation context
 */
export interface WithAnimationContextProps {
  /** Skip providing animation context (assume parent provides) */
  skipAnimationContext?: boolean;
}

/**
 * Combined interface for components that might need both tooltip and animation contexts
 */
export interface WithTooltipAndAnimationContextProps extends WithAnimationContextProps {
  /** Skip providing tooltip context (assume parent provides) */
  skipTooltipContext?: boolean;
}

/**
 * Re-export generic utilities from UI package for convenience
 */
export {
  createContextSolution,
  withOptionalContext,
  createContextHook,
  createContextProvider,
  composeContexts,
  useOptionalContext,
  createContextChecker,
  type ContextConfig,
  type ContextSolutionConfig,
  type OptionalContextProps,
} from "@semio/ui";

export { type WithTooltipContextProps } from "@semio/ui";
