import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { groupWeeks, repositoryLanguages, renderDashboard } from './graphics.mjs';
import { analyze } from './profile.mjs';

test('weekly history groups Monday through Sunday across year boundaries without losing contributions', () => {
  const days = [
    { date: '2023-12-31', contributionCount: 7 },
    { date: '2024-01-01', contributionCount: 3 },
    { date: '2024-01-07', contributionCount: 5 },
    { date: '2024-01-08', contributionCount: 0 },
  ];
  assert.deepEqual(groupWeeks(days), [
    { date: '2023-12-25', value: 7 },
    { date: '2024-01-01', value: 8 },
    { date: '2024-01-08', value: 0 },
  ]);
  assert.equal(groupWeeks(days).reduce((sum, week) => sum + week.value, 0), 15);
});

test('repository bars retain each language byte weight and rank only eligible code', () => {
  const repo = (name, sizes, isArchived = false) => ({ name, isArchived,
    languages: { edges: sizes.map((size, i) => ({ size, node: { name: ['Rust', 'Shell'][i] } })) } });
  const snapshot = { repos: [repo('small', [10, 2]), repo('big', [150, 50]),
    repo('profile', [999999]), repo('old', [999999], true), repo('empty', [])] };
  const result = repositoryLanguages(snapshot, { projects: [{ name: 'big', title: 'Big project' }], excludeFromLanguages: ['profile'] });
  assert.deepEqual(result.map(repo => repo.name), ['big', 'small']);
  assert.equal(result[0].title, 'Big project');
  assert.equal(result[0].total, 200);
  assert.equal(result[0].languages[0].bytes / result[0].total, .75);
});

test('all chart variants reconcile with the live snapshot and produce finite SVG geometry', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../data/profile.json', import.meta.url)));
  const config = JSON.parse(await readFile(new URL('../profile.config.json', import.meta.url)));
  const stats = analyze(snapshot, config);
  assert.equal(groupWeeks(stats.days).reduce((sum, week) => sum + week.value, 0), stats.total);
  assert.equal(stats.weekdays.reduce((sum, value) => sum + value, 0), stats.total);
  for (const theme of ['light', 'dark']) for (const mobile of [false, true]) {
    const svg = renderDashboard(snapshot, stats, theme, mobile, config);
    assert.doesNotMatch(svg, /NaN|Infinity|undefined|<script|foreignObject/);
    assert.match(svg, /Contribution history/);
    assert.match(svg, /Language mix/);
    assert.match(svg, /Inside the repositories/);
    assert.equal((svg.match(/class="ring"/g) ?? []).length, stats.languages.length);
  }
});

test('published snake assets include actual path animation, theme colors, and reduced-motion fallback', async () => {
  for (const theme of ['light', 'dark']) {
    const svg = await readFile(new URL(`../assets/snake-${theme}.svg`, import.meta.url), 'utf8');
    assert.match(svg, /@keyframes/);
    assert.match(svg, /class="s s0"/);
    assert.match(svg, /class="c(?: c[a-z0-9]+)?"/);
    assert.match(svg, /prefers-reduced-motion/);
    assert.match(svg, /\.s,\.u\{display:none\}/);
    assert.match(svg, /aria-labelledby="snake-title snake-desc"/);
    assert.match(svg, theme === 'light' ? /--cs:#24292f/ : /--cs:#e6edf3/);
    assert.doesNotMatch(svg, /<script|foreignObject/);
  }
});
