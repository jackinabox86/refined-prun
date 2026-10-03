// BTF fuel and reactor handles store a fraction of full output.
// RT Edit waypoint handles are whole percents. 0.05 is 5%.
export function routeUsagePercent(
  flightFraction: number,
  slider: { min: number; max: number; step: number },
): number {
  const percent = flightFraction * 100;
  const stepped = Math.round(percent / slider.step) * slider.step;
  if (stepped < slider.min) {
    return slider.min;
  }
  if (stepped > slider.max) {
    return slider.max;
  }
  return stepped;
}
