export const TIMELINE_PADDING = 7;
export const DEFAULT_ANIMATION_ID = "default-animation";
export const DEFAULT_TRACK_HEIGHT = 36;

export const CARET_HALF_WIDTH = 6;
export const VERTICAL_POINTER_PATH = `M${(-1 * CARET_HALF_WIDTH).toString()},18L${(-1 * CARET_HALF_WIDTH).toString()},2C${(-1 * CARET_HALF_WIDTH).toString()},0.896 ${(-1 * CARET_HALF_WIDTH + 0.896).toString()},0 ${(-1 * CARET_HALF_WIDTH + 2).toString()},0L${(CARET_HALF_WIDTH - 2).toString()},0C${(CARET_HALF_WIDTH - 0.896).toString()},0 ${CARET_HALF_WIDTH.toString()},0.896 ${CARET_HALF_WIDTH.toString()},2L${CARET_HALF_WIDTH.toString()},18C${CARET_HALF_WIDTH.toString()},18.953 0,23 0,23C0,23 ${(-1 * CARET_HALF_WIDTH).toString()},18.953 ${(-1 * CARET_HALF_WIDTH).toString()},18Z`;
export const HORIZONTAL_POINTER_PATH = `M${(-1 * CARET_HALF_WIDTH + 2).toString()},18.333C${(-1 * CARET_HALF_WIDTH + 1.5).toString()},16.667 ${(-1 * CARET_HALF_WIDTH).toString()},10 ${(-1 * CARET_HALF_WIDTH).toString()},10C${(-1 * CARET_HALF_WIDTH).toString()},10 ${(-1 * CARET_HALF_WIDTH + 1.5).toString()},3.333 ${(-1 * CARET_HALF_WIDTH + 2).toString()},1.667C${(-1 * CARET_HALF_WIDTH + 2.231).toString()},0.896 ${(-1 * CARET_HALF_WIDTH + 2.448).toString()},0 ${(-1 * CARET_HALF_WIDTH + 3).toString()},0L${(CARET_HALF_WIDTH - 3).toString()},0C${(CARET_HALF_WIDTH - 2.448).toString()},0 ${(CARET_HALF_WIDTH - 2.231).toString()},0.896 ${(CARET_HALF_WIDTH - 2).toString()},1.667C${(CARET_HALF_WIDTH - 1.5).toString()},3.333 ${CARET_HALF_WIDTH.toString()},10 ${CARET_HALF_WIDTH.toString()},10C${CARET_HALF_WIDTH.toString()},10 ${(CARET_HALF_WIDTH - 1.5).toString()},16.667 ${(CARET_HALF_WIDTH - 2).toString()},18.333C${(CARET_HALF_WIDTH - 2.231).toString()},19.104 ${(CARET_HALF_WIDTH - 2.448).toString()},20 ${(CARET_HALF_WIDTH - 3).toString()},20L${(-1 * CARET_HALF_WIDTH + 3).toString()},20C${(-1 * CARET_HALF_WIDTH + 2.448).toString()},20 ${(-1 * CARET_HALF_WIDTH + 2.231).toString()},19.104 ${(-1 * CARET_HALF_WIDTH + 2).toString()},18.333Z`;
export const VERTICAL_HALF_POINTER_PATH = `M0,23L0,2C0,0.896 0.896,0 ${(CARET_HALF_WIDTH / 2).toString()},0C${(CARET_HALF_WIDTH - 0.896).toString()},0 ${CARET_HALF_WIDTH.toString()},0.896 ${CARET_HALF_WIDTH.toString()},2L${CARET_HALF_WIDTH.toString()},18C${CARET_HALF_WIDTH.toString()},18.953 0,23 0,23Z`;

export const TRANSITION_CONFIG = {
  type: "tween",
  duration: 0.2,
  ease: "easeInOut",
};
