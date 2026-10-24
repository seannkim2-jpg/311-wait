/** Shared chart styling (tufte-data-viz skill: no grid, light axes, direct labels). */
export const C = {
  data: '#2F4BD0',
  dataBand: '#2F4BD0',
  city: '#7A818D',
  notfixed: '#A35F00',
  overdue: '#C8242D',
  ink: '#15171C',
  ink2: '#4A505C',
  ink3: '#636A76',
  rule: '#E6E7EA',
  font: '"Public Sans Variable", ui-sans-serif, system-ui, sans-serif',
}

/** Day ticks for the stretched time axis, trimmed to the observed window. */
export function dayTicks(maxDay: number): number[] {
  const base = [0, 1, 3, 7, 14, 30, 60, 90]
  return base.filter((t) => t <= maxDay - 4).concat(Math.floor(maxDay))
}

export const axisTick = { fontSize: 12, fill: C.ink3, fontFamily: C.font }
