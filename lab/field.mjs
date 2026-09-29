// Shared geometry for the live sculpture and GitHub's script-free SVG preview.
export const TAU = Math.PI * 2;
export const MODES = [
  { name: 'Resonance', domain: 'SOUND', project: 'Suture', color: '#aff1cb',
    description: 'A waveform folded into an endless knot. Every strand finds its rhythm.' },
  { name: 'Architecture', domain: 'SILICON', project: 'tang25k-cpu', color: '#bcb0ff',
    description: 'Signals become structure. A lattice of possibilities, clocked into motion.' },
  { name: 'Afterimage', domain: 'CINEMA', project: 'Letterboxd-AI-Review', color: '#ffc29e',
    description: 'A thousand frames, one moving memory. Follow the trails between them.' },
  { name: 'Momentum', domain: 'MOTION', project: 'TempoPilot', color: '#a7d9fa',
    description: 'Time takes a different shape. Bend the orbit. Find your own tempo.' },
];

export function pointAt(mode, u, v, time = 0) {
  if (mode === 1) {
    const a = u * TAU;
    const b = v * TAU;
    const radius = 1.02 + .13 * Math.sin(a * 4 + time);
    // Rounded superellipsoid: a circuit-like, almost cubical lattice.
    const signed = x => Math.sign(x) * Math.pow(Math.abs(x), .45);
    return [radius * signed(Math.cos(a)) * signed(Math.cos(b)),
      radius * signed(Math.sin(b)), radius * signed(Math.sin(a)) * signed(Math.cos(b))];
  }
  if (mode === 2) {
    const a = u * TAU;
    const twist = a * 1.5 + time * .14;
    const band = (v - .5) * .95;
    return [(1.18 + band * Math.cos(twist)) * Math.cos(a),
      band * Math.sin(twist), (1.18 + band * Math.cos(twist)) * Math.sin(a)];
  }
  if (mode === 3) {
    const a = u * TAU;
    const b = v * TAU;
    const r = 1.05 + .28 * Math.cos(b * 3 + a * 2 + time * .3);
    return [r * Math.cos(a), .48 * Math.sin(b) + .2 * Math.sin(a * 3), r * Math.sin(a)];
  }
  const a = u * TAU;
  const b = v * TAU;
  const r = .82 + .32 * Math.cos(a * 3 + time * .18);
  const tube = .19 + .035 * Math.sin(a * 6 - time);
  return [(r + tube * Math.cos(b)) * Math.cos(a * 2),
    .48 * Math.sin(a * 3 + time * .18) + tube * Math.sin(b),
    (r + tube * Math.cos(b)) * Math.sin(a * 2)];
}

export function project(point, yaw, pitch, scale, cx, cy) {
  const [x, y, z] = point;
  const xx = x * Math.cos(yaw) + z * Math.sin(yaw);
  const zz = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const yy = y * Math.cos(pitch) - zz * Math.sin(pitch);
  const depth = y * Math.sin(pitch) + zz * Math.cos(pitch);
  const perspective = 4 / (4 + depth);
  return [cx + xx * scale * perspective, cy + yy * scale * perspective, depth];
}
