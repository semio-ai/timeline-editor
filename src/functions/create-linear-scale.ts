// Create a linear scale function
export function createLinearScale(
  domain: [number, number],
  range: [number, number],
): (value: number) => number {
  const [domainMin, domainMax] = domain;
  const [rangeMin, rangeMax] = range;
  const domainRange = domainMax - domainMin;
  const outputRange = rangeMax - rangeMin;

  return (value: number) => {
    const normalized = (value - domainMin) / domainRange;
    return rangeMin + normalized * outputRange;
  };
}
