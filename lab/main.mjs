import { MODES, pointAt, project, TAU } from './field.mjs';

const canvas = document.querySelector('#field');
const ctx = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const pauseButton = document.querySelector('#pause');
const pointer = { x: 0, y: 0, inside: false, down: false, moved: false };
const state = { mode: 0, previous: 0, morph: 1, time: 0, yaw: .5, pitch: -.6,
  targetYaw: .5, targetPitch: -.6, paused: reducedMotion.matches, speed: 1 };
let width = 0, height = 0, lastTime = 0, frame = 0, bursts = [];
const FORMS = ['TORUS KNOT / 2:3', 'CIRCUIT / LATTICE', 'TWIST / 3π', 'ORBIT / MODULATED'];
const strands = 25, samples = 112;

function updatePause() {
  pauseButton.setAttribute('aria-pressed', String(state.paused));
  pauseButton.textContent = state.paused ? 'Resume motion' : 'Pause motion';
  document.querySelector('#state-label').textContent = state.paused ? 'STILL FRAME' : 'IN MOTION';
}

function wake() {
  if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  const pixelRatio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  wake();
}

function chooseMode(mode) {
  if (mode === state.mode) return;
  state.previous = state.mode;
  state.mode = mode;
  state.morph = reducedMotion.matches || state.paused ? 1 : 0;
  const info = MODES[mode];
  document.documentElement.style.setProperty('--accent', info.color);
  document.querySelector('#mode-label').textContent = `0${mode + 1} / ${info.name.toUpperCase()}`;
  document.querySelector('#form-label').textContent = FORMS[mode];
  document.querySelector('#description').textContent = info.description;
  document.querySelector('.note-index').textContent = `FIELD NOTE 0${mode + 1}`;
  const link = document.querySelector('#project-link');
  link.textContent = `Explore ${info.project} ↗`;
  link.href = `https://github.com/Erik0318/${info.project}`;
  document.querySelectorAll('.mode').forEach((button, i) => {
    button.classList.toggle('active', i === mode);
    button.setAttribute('aria-pressed', String(i === mode));
  });
  document.querySelector('#announcement').textContent = `${info.name}. ${info.description}`;
  wake();
}

function reset() {
  state.targetYaw = state.yaw = .5;
  state.targetPitch = state.pitch = -.6;
  state.time = 0;
  bursts = [];
  pointer.inside = false;
  document.querySelector('#announcement').textContent = 'Orbit reset.';
  wake();
}

function togglePause() {
  state.paused = !state.paused;
  state.morph = 1;
  bursts = [];
  updatePause();
  wake();
}

function coordinates(event) {
  const rect = canvas.getBoundingClientRect();
  return [event.clientX - rect.left, event.clientY - rect.top];
}

canvas.addEventListener('pointermove', event => {
  const [x, y] = coordinates(event);
  if (pointer.down) {
    state.targetYaw += (x - pointer.x) * .008;
    state.targetPitch = Math.max(-1.4, Math.min(1.4, state.targetPitch + (y - pointer.y) * .008));
    if (Math.hypot(x - pointer.startX, y - pointer.startY) > 5) pointer.moved = true;
  }
  Object.assign(pointer, { x, y, inside: true });
  wake();
});
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  const [x, y] = coordinates(event);
  Object.assign(pointer, { x, y, startX: x, startY: y, inside: true, down: true, moved: false });
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('dragging');
  canvas.focus({ preventScroll: true });
});
function release(event) {
  if (pointer.down && !pointer.moved && event.type === 'pointerup' && !state.paused && !reducedMotion.matches) {
    bursts.push({ x: pointer.x, y: pointer.y, age: 0 });
    bursts = bursts.slice(-5);
  }
  pointer.down = false;
  canvas.classList.remove('dragging');
  if (event.pointerType !== 'mouse') pointer.inside = false;
  wake();
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('lostpointercapture', () => { pointer.down = false; canvas.classList.remove('dragging'); });
canvas.addEventListener('pointerleave', () => { pointer.inside = false; wake(); });
document.querySelectorAll('.mode').forEach(button => button.addEventListener('click', () => chooseMode(Number(button.dataset.mode))));
pauseButton.addEventListener('click', togglePause);
document.querySelector('#reset').addEventListener('click', reset);
document.querySelector('#tempo').addEventListener('input', event => {
  state.speed = Number(event.target.value);
  document.querySelector('#tempo-value').textContent = `${state.speed.toFixed(1)}×`;
});
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.target.matches('input,textarea,select,[contenteditable]')) return;
  if (/^[1-4]$/.test(event.key)) chooseMode(Number(event.key) - 1);
  else if (event.key.toLowerCase() === 'r') reset();
  else if (event.code === 'Space' && !event.target.closest('button,a')) {
    event.preventDefault();
    togglePause();
  } else if (event.target === canvas && event.key.startsWith('Arrow')) {
    event.preventDefault();
    if (event.key === 'ArrowLeft') state.targetYaw -= .15;
    if (event.key === 'ArrowRight') state.targetYaw += .15;
    if (event.key === 'ArrowUp') state.targetPitch = Math.max(-1.4, state.targetPitch - .15);
    if (event.key === 'ArrowDown') state.targetPitch = Math.min(1.4, state.targetPitch + .15);
    wake();
  }
});
reducedMotion.addEventListener('change', () => {
  state.paused = reducedMotion.matches;
  state.morph = 1;
  bursts = [];
  updatePause();
  wake();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
  else { lastTime = 0; wake(); }
});

function draw() {
  if (!width || !height) return;
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2, cy = height * .48, scale = Math.min(width, height) * .27;
  const color = MODES[state.mode].color;
  // A quiet starfield and instrument ring anchor the moving geometry.
  for (let i = 0; i < 56; i++) {
    const x = (i * 167.17 + 11) % width, y = (i * 91.31 + 27) % (height - 40);
    ctx.fillStyle = color;
    ctx.globalAlpha = .1 + .15 * (1 + Math.sin(state.time * .5 + i)) / 2;
    ctx.fillRect(x, y, i % 5 ? 1 : 2, i % 5 ? 1 : 2);
  }
  ctx.globalAlpha = .3;
  ctx.strokeStyle = color;
  ctx.lineWidth = .6;
  ctx.beginPath();
  ctx.ellipse(cx, cy, scale * 1.6, scale * 1.6, 0, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = .5;
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * TAU + state.time * .017;
    const r = scale * 1.64;
    const length = i % 6 ? 3 : 8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a) * (r + length), cy + Math.sin(a) * (r + length));
    ctx.stroke();
  }
  const morph = state.morph * state.morph * (3 - 2 * state.morph);
  const lines = [];
  for (let v = 0; v < strands; v++) {
    const points = [];
    let depth = 0;
    for (let i = 0; i <= samples; i++) {
      let p = pointAt(state.mode, i / samples, v / strands, state.time);
      if (morph < 1) {
        const from = pointAt(state.previous, i / samples, v / strands, state.time);
        p = p.map((x, k) => from[k] + (x - from[k]) * morph);
      }
      const q = project(p, state.yaw, state.pitch, scale, cx, cy);
      if (pointer.inside) {
        const dx = q[0] - pointer.x, dy = q[1] - pointer.y;
        const distance = Math.hypot(dx, dy);
        const strength = Math.exp(-distance * distance / 6500) * 24;
        q[0] += dx / (distance + 1) * strength;
        q[1] += dy / (distance + 1) * strength;
      }
      for (const burst of bursts) {
        const dx = q[0] - burst.x, dy = q[1] - burst.y;
        const distance = Math.hypot(dx, dy);
        const wave = Math.exp(-Math.pow((distance - burst.age * 210) / 35, 2)) * 17 * (1 - burst.age / 1.8);
        q[0] += dx / (distance + 1) * wave;
        q[1] += dy / (distance + 1) * wave;
      }
      points.push(q);
      depth += q[2];
    }
    lines.push({ points, depth: depth / (samples + 1), index: v });
  }
  lines.sort((a, b) => b.depth - a.depth);
  for (const { points, depth, index } of lines) {
    const bright = index % 5 === 0;
    ctx.globalAlpha = Math.max(.12, Math.min(.85, (bright ? .75 : .36) - depth * .19));
    ctx.strokeStyle = bright ? '#f0edbf' : color;
    ctx.lineWidth = bright ? 1.25 : .7;
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.stroke();
    for (let j = 0; j < 3; j++) {
      const p = points[Math.floor((state.time * (9 + index % 3) + index * 7 + j * samples / 3) % samples)];
      ctx.globalAlpha = .5;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, TAU); ctx.fill();
      ctx.globalAlpha = .9;
      ctx.fillStyle = '#fcfff2';
      ctx.beginPath(); ctx.arc(p[0], p[1], bright ? 1.5 : .9, 0, TAU); ctx.fill();
    }
  }
  if (pointer.inside && !pointer.down) {
    ctx.globalAlpha = .4;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 13, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pointer.x - 4, pointer.y); ctx.lineTo(pointer.x + 4, pointer.y);
    ctx.moveTo(pointer.x, pointer.y - 4); ctx.lineTo(pointer.x, pointer.y + 4); ctx.stroke();
  }
  for (const burst of bursts) {
    ctx.globalAlpha = .3 * (1 - burst.age / 1.8);
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.arc(burst.x, burst.y, burst.age * 210, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function tick(now) {
  frame = 0;
  const dt = Math.min((now - (lastTime || now)) / 1000, .04);
  lastTime = now;
  if (!state.paused) {
    state.time += dt * state.speed;
    if (!pointer.down) state.targetYaw += dt * .1 * state.speed;
    state.morph = Math.min(1, state.morph + dt / 1.2);
    bursts.forEach(burst => { burst.age += dt; });
    bursts = bursts.filter(burst => burst.age < 1.8);
  }
  const smoothing = reducedMotion.matches || state.paused ? 1 : 1 - Math.exp(-dt * 10);
  state.yaw += (state.targetYaw - state.yaw) * smoothing;
  state.pitch += (state.targetPitch - state.pitch) * smoothing;
  draw();
  if (!state.paused) wake();
}

if (matchMedia('(pointer: coarse)').matches) document.querySelector('#gesture-hint').textContent = 'DRAG SIDEWAYS TO ORBIT · TAP TO RIPPLE';
new ResizeObserver(resize).observe(canvas);
updatePause();
resize();
