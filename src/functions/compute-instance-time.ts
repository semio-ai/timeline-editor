export function computeWorldStamp(localStamp: number, timescale: number, offset: number): number {
  return localStamp / timescale + offset;
}

export function computeLocalStamp(worldStamp: number, timescale: number, offset: number): number {
  return (worldStamp - offset) * timescale;
}
