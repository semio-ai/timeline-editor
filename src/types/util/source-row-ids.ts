/** Source row id lists used by the UI for row ordering. */
export interface VisibleSourceRowIds {
  /**
   * Flat list of every visible row (groups + leaves) in rendering order.
   */
  flat: string[];
  /**
   * Leaf rows only, respecting group expansion state, used by spline renderers.
   */
  spline: string[];
}
