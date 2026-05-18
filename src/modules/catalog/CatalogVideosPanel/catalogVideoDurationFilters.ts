export const minimumDurationMinutes = 0;
export const maximumDurationMinutes = 3 * 60;
export const durationSliderStepMinutes = 5;

export function formatDurationRange([minimumMinutes, maximumMinutes]: [
  number,
  number,
]) {
  return `${formatDurationFilterValue(minimumMinutes)} - ${formatDurationFilterValue(maximumMinutes)}`;
}

export function formatDurationFilterValue(minutes: number) {
  if (minutes === minimumDurationMinutes) {
    return "0m";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}
