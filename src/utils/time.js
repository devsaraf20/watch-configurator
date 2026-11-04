/**
 * Hand angles in radians (clockwise from 12 o'clock).
 * Hours and minutes rest at the classic 10:10 "smile" product pose,
 * while the second hand sweeps in real time.
 */
export function handAngles(date = new Date()) {
  const seconds = date.getSeconds() + date.getMilliseconds() / 1000
  const TAU = Math.PI * 2
  return {
    hour: ((10 + 10 / 60) / 12) * TAU,
    minute: (10 / 60) * TAU,
    second: (seconds / 60) * TAU,
  }
}
