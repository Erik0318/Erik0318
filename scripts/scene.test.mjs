import test from 'node:test';
import assert from 'node:assert/strict';
import { pointAt, project, MODES } from '../lab/field.mjs';
import { renderScene } from './scene.mjs';

test('every sculpture stays finite and inside its projection volume over a full orbit', () => {
  for (let mode = 0; mode < MODES.length; mode++) {
    for (const time of [0, 1, 20, 200]) for (let u = 0; u <= 1; u += .05) for (let v = 0; v <= 1; v += .1) {
      const point = pointAt(mode, u, v, time);
      assert.ok(point.every(x => Number.isFinite(x) && Math.abs(x) < 1.8));
      for (const yaw of [0, 1, 3, 6]) {
        const projected = project(point, yaw, -.6, 150, 300, 300);
        assert.ok(projected.every(Number.isFinite));
        assert.ok(projected[0] > 0 && projected[0] < 600);
        assert.ok(projected[1] > 0 && projected[1] < 600);
      }
    }
  }
});

test('README scenes are deterministic, script-free, and have static reduced-motion frames', () => {
  for (const theme of ['light', 'dark']) for (const mobile of [false, true]) {
    const svg = renderScene(theme, mobile);
    assert.equal(svg, renderScene(theme, mobile));
    assert.doesNotMatch(svg, /NaN|Infinity|undefined|<script|foreignObject|https:\/\//);
    assert.match(svg, /prefers-reduced-motion:reduce/);
    assert.match(svg, /aria-labelledby="title desc"/);
    assert.match(svg, /\.signal\{display:none\}/);
    assert.match(svg, mobile ? /viewBox="0 0 480 640"/ : /viewBox="0 0 960 490"/);
    assert.ok(Buffer.byteLength(svg) < 130_000);
  }
});
