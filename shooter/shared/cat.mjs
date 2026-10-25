// Rounded, collision-safe route: bed -> bedroom doorway -> corridor -> dark library.
const waypoints = [
  [9.7, 14],
  [6, 13.5],
  [0, 13.5],
  [0, -13.5],
  [-7.5, -13.5],
];
const points = [waypoints[0]];
for (let i = 1; i < waypoints.length - 1; i++) {
  const a = waypoints[i - 1],
    b = waypoints[i],
    c = waypoints[i + 1];
  const before = Math.hypot(b[0] - a[0], b[1] - a[1]),
    after = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const radius = Math.min(0.8, before / 3, after / 3);
  const entry = [
    b[0] + ((a[0] - b[0]) * radius) / before,
    b[1] + ((a[1] - b[1]) * radius) / before,
  ];
  const exit = [
    b[0] + ((c[0] - b[0]) * radius) / after,
    b[1] + ((c[1] - b[1]) * radius) / after,
  ];
  points.push(entry);
  for (let n = 1; n <= 12; n++) {
    const t = n / 12,
      u = 1 - t;
    points.push([
      u * u * entry[0] + 2 * u * t * b[0] + t * t * exit[0],
      u * u * entry[1] + 2 * u * t * b[1] + t * t * exit[1],
    ]);
  }
}
points.push(waypoints.at(-1));
const lengths = [0];
for (let i = 1; i < points.length; i++)
  lengths.push(
    lengths.at(-1) +
      Math.hypot(
        points[i][0] - points[i - 1][0],
        points[i][1] - points[i - 1][1],
      ),
  );
export const CAT_ESCAPE_SECONDS = 0.65 + lengths.at(-1) / 4.8;
function at(distance) {
  const i = Math.max(
    1,
    lengths.findIndex((n) => n >= distance),
  );
  const end = distance >= lengths.at(-1) ? points.length - 1 : i;
  const f = Math.min(
    1,
    Math.max(
      0,
      (distance - lengths[end - 1]) / (lengths[end] - lengths[end - 1]),
    ),
  );
  return points[end - 1].map((n, k) => n + (points[end][k] - n) * f);
}
export function catPose(seconds) {
  if (seconds <= 0)
    return {
      x: 12,
      y: 0.98,
      z: 14,
      yaw: 0,
      opacity: 1,
      running: false,
      visible: true,
    };
  if (seconds < 0.65) {
    const t = seconds / 0.65;
    return {
      x: 12 - 2.3 * t,
      y: 0.98 - 0.74 * t + Math.sin(t * Math.PI) * 0.55,
      z: 14,
      yaw: 0,
      opacity: 1,
      running: true,
      visible: true,
    };
  }
  const distance = Math.min(lengths.at(-1), (seconds - 0.65) * 4.8),
    p = at(distance);
  const ahead = at(Math.min(lengths.at(-1), distance + 0.08)),
    behind = at(Math.max(0, distance - 0.08));
  return {
    x: p[0],
    y: 0.24 + Math.abs(Math.sin(seconds * 21)) * 0.025,
    z: p[1],
    yaw: Math.atan2(ahead[1] - behind[1], -(ahead[0] - behind[0])),
    opacity: Math.min(1, Math.max(0, (lengths.at(-1) - distance) / 1.5)),
    running: true,
    visible: seconds < CAT_ESCAPE_SECONDS,
  };
}
