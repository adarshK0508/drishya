// One source of truth for rendered furniture, movement and bullet occlusion.
export const mansionRooms = [
  { name: "Library", x: -12, z: -13.5, color: 0x344d47, motif: "books" },
  { name: "Dining room", x: -12, z: 0, color: 0x713b35, motif: "diamond" },
  { name: "Chapel", x: -12, z: 13.5, color: 0x494360, motif: "cross" },
  { name: "Study", x: 12, z: -13.5, color: 0x665535, motif: "clock" },
  { name: "Kitchen", x: 12, z: 0, color: 0x3f555f, motif: "tiles" },
  { name: "Bedroom", x: 12, z: 13.5, color: 0x623e50, motif: "flower" },
];
export const mansionProps = [];
const add = (kind, x, z, w, d, h, room = -1) =>
  mansionProps.push({ kind, x, z, w, d, h, room });
// The complete mansion is 42 x 42 metres. Doorways are 2.8m wide.
add("wall", -21, 0, 0.3, 21, 3.8);
add("wall", 21, 0, 0.3, 21, 3.8);
add("wall", 0, -21, 21, 0.3, 3.8);
add("wall", 0, 21, 21, 0.3, 3.8);
for (const x of [-3, 3]) {
  for (const [a, b] of [
    [-21, -14.9],
    [-12.1, -1.4],
    [1.4, 12.1],
    [14.9, 21],
  ])
    add("wall", x, (a + b) / 2, 0.22, (b - a) / 2, 3.8);
}
for (const z of [-6.75, 6.75]) {
  for (const [a, b] of [
    [-21, -13.4],
    [-10.6, -3],
    [3, 10.6],
    [13.4, 21],
  ])
    add("wall", (a + b) / 2, z, (b - a) / 2, 0.22, 3.8);
}
// Tall cover with walkable space behind it, never just a decorative hiding spot.
for (let i = 0; i < mansionRooms.length; i++) {
  const r = mansionRooms[i],
    side = Math.sign(r.x);
  add("wardrobe", r.x + side * 5.4, r.z + 2.8, 1.5, 0.65, 2.5, i);
  add("screen", r.x - side * 3.2, r.z - 2.8, 0.24, 1.7, 2.15, i);
}
for (const x of [-19, -16, -13]) add("bookcase", x, -18.9, 0.95, 0.5, 2.9, 0);
add("desk", -11, -12, 1.3, 0.7, 1.05, 0);
add("table", -12, 0, 2.3, 1.05, 1.05, 1);
for (const x of [-14, -10])
  for (const z of [-1.9, 1.9]) add("chair", x, z, 0.42, 0.42, 1.25, 1);
for (const z of [11.2, 15.8]) add("pew", -12, z, 2.1, 0.45, 1.35, 2);
add("altar", -17.7, 18.8, 1.4, 0.6, 1.7, 2);
add("desk", 12, -15, 1.8, 0.8, 1.15, 3);
add("clock", 18.8, -18.6, 0.55, 0.4, 2.85, 3);
add("counter", 17.9, -4.9, 2, 0.65, 1.35, 4);
add("counter", 12, 0, 1.7, 0.8, 1.35, 4);
add("bed", 12, 14, 1.5, 2.05, 0.75, 5);
add("dresser", 18.8, 18.8, 1.4, 0.65, 1.25, 5);
export const mansionColliders = mansionProps.map((p) => [
  p.x,
  p.z,
  p.w,
  p.d,
  p.h,
]);
export const mansionSpawns = {
  hunter: [0, 19],
  hider: [0, -16],
  duel: [
    [-12, -10],
    [12, 17],
  ],
};
