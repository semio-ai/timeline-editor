export const buildHandleOffsetKey = (keypointId: string, attributePath?: string[]): string => {
  if (!attributePath || attributePath.length === 0) {
    return keypointId;
  }

  return `${keypointId}::${attributePath.join(".")}`;
};

export const parseHandleOffsetKey = (
  key: string,
): { keypointId: string; attributePath?: string[] } => {
  const [keypointId, path] = key.split("::");
  return {
    keypointId,
    attributePath: path ? path.split(".") : undefined,
  };
};
