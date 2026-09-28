import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, renderDashboard, replaceSection, escape, generatedReadme, generatedDetails } from './profile.mjs';

const config = { username: 'sample', excludeFromLanguages: ['profile'], projects: [] };
const repo = (name, bytes, extra = {}) => ({ name, url: `https://github.com/sample/${name}`, isArchived: false,
  stargazerCount: 2, forkCount: 1, languages: { edges: bytes.map(([name, size]) => ({ node: { name }, size })) }, ...extra });
function fixture(counts, start = '2024-02-27') {
  const days = counts.map((contributionCount, i) => {
    const date = new Date(Date.parse(start) + i * 86400000);
    return { date: date.toISOString().slice(0, 10), weekday: date.getUTCDay(), contributionCount };
  });
  return { schemaVersion: 1, login: 'sample', updatedAt: `${days.at(-1).date}T12:00:00Z`, repos: [],
    contributions: { startedAt: `${start}T00:00:00Z`, totalCommitContributions: 4, totalIssueContributions: 1,
      totalPullRequestContributions: 2, totalPullRequestReviewContributions: 0,
      contributionCalendar: { totalContributions: counts.reduce((a, b) => a + b, 0), weeks: [{ contributionDays: days }] } } };
}

test('streaks span leap day, and an unfinished today has a grace period', () => {
  const stats = analyze(fixture([1, 2, 3, 0]), config);
  assert.equal(stats.current, 3);
  assert.equal(stats.longest, 3);
  assert.equal(stats.active, 3);
  assert.equal(stats.bestDay, 3);
  assert.equal(stats.weekdays.reduce((a, b) => a + b, 0), 6);
});

test('rendered dates use Pacific time while date-only contribution buckets retain their dates', () => {
  const snapshot = fixture([1]);
  snapshot.updatedAt = '2024-02-27T02:30:00Z';
  snapshot.repos = [repo('recent', [], { pushedAt: snapshot.updatedAt,
    latestRelease: { tagName: 'v1', publishedAt: snapshot.updatedAt, url: 'https://github.com/sample/recent/releases/tag/v1' } })];
  const stats = analyze(snapshot, config);
  assert.equal(stats.days[0].date, '2024-02-27');
  assert.match(generatedReadme(snapshot, stats, config), /2024-02-26 18:30 PST/);
  const details = generatedDetails(snapshot, stats, config);
  assert.match(details, /\| 2024-02-26 \|/);
  assert.match(details, /\*\* · 2024-02-26/);
  assert.match(details, /GitHub calendar dates 2024-02-27 through 2024-02-27/);
  for (const theme of ['light', 'dark']) for (const mobile of [false, true]) {
    assert.match(renderDashboard(snapshot, stats, theme, mobile), /Feb 26, 2024 · PT/);
  }
});

test('a gap yesterday breaks the current streak, without erasing the longest', () => {
  const stats = analyze(fixture([1, 1, 1, 0, 0]), config);
  assert.equal(stats.current, 0);
  assert.equal(stats.longest, 3);
  assert.equal(analyze(fixture([0, 3, 0, 4, 2]), config).current, 2);
});

test('all-zero and single-day calendars have defined metrics', () => {
  assert.equal(analyze(fixture([0]), config).current, 0);
  assert.equal(analyze(fixture([3]), config).longest, 1);
  assert.equal(analyze(fixture([0, 0]), config).bestDay, 0);
});

test('calendar validation rejects missing dates, duplicates, negative counts, and mismatched totals', () => {
  for (const mutate of [
    s => s.contributions.contributionCalendar.weeks[0].contributionDays.splice(1, 1),
    s => s.contributions.contributionCalendar.weeks[0].contributionDays.push(s.contributions.contributionCalendar.weeks[0].contributionDays[0]),
    s => { s.contributions.contributionCalendar.weeks[0].contributionDays[0].contributionCount = -1; },
    s => { s.contributions.contributionCalendar.totalContributions = 900; },
  ]) {
    const snapshot = fixture([1, 0, 3]);
    mutate(snapshot);
    assert.throws(() => analyze(snapshot, config));
  }
});

test('languages weight actual bytes, exclude archived/profile code, and preserve Other', () => {
  const snapshot = fixture([1]);
  snapshot.repos = [repo('one', [['Rust', 200], ['TypeScript', 100], ['C', 50]]),
    repo('two', [['Rust', 100], ['Shell', 30], ['CSS', 20], ['HTML', 15], ['Makefile', 5]]),
    repo('profile', [['JavaScript', 1000000]]), repo('old', [['Python', 1000000]], { isArchived: true })];
  const stats = analyze(snapshot, config);
  assert.equal(stats.languages[0].name, 'Rust');
  assert.equal(stats.languages[0].bytes, 300);
  assert.equal(stats.languages.at(-1).name, 'Other');
  assert.equal(stats.languages.at(-1).bytes, 20);
  assert.ok(Math.abs(stats.languages.reduce((sum, l) => sum + l.percent, 0) - 100) < 0.00001);
  assert.equal(stats.stars, 8);
  assert.equal(stats.repos, 4);
});

test('SVG themes and mobile variants handle empty data, escape names, and respect reduced motion', () => {
  const snapshot = fixture([0]);
  snapshot.login = 'a<&b';
  const localConfig = { ...config, username: snapshot.login };
  const stats = analyze(snapshot, localConfig);
  for (const theme of ['light', 'dark']) for (const mobile of [false, true]) {
    const svg = renderDashboard(snapshot, stats, theme, mobile);
    assert.ok(!/NaN|Infinity|<script|https?:\/\//.test(svg.replace('http://www.w3.org/2000/svg', '')));
    assert.ok(svg.includes('a&lt;&amp;b'));
    assert.ok(svg.includes('prefers-reduced-motion'));
    assert.ok(svg.includes(mobile ? 'width="420"' : 'width="900"'));
    assert.ok(svg.includes('No language data yet.'));
  }
});

test('README update preserves handwritten content and rejects missing/repeated/reversed markers', () => {
  const source = '# Name\n<!-- profile:start -->\nold\n<!-- profile:end -->\ncontact';
  assert.equal(replaceSection(source, 'new'), '# Name\n<!-- profile:start -->\nnew\n<!-- profile:end -->\ncontact');
  for (const invalid of ['', source + '<!-- profile:start -->', '<!-- profile:end --><!-- profile:start -->']) {
    assert.throws(() => replaceSection(invalid, 'new'));
  }
});

test('unavailable projects abort; API-provided titles cannot inject markup or table columns', () => {
  const snapshot = fixture([1]);
  const stats = analyze(snapshot, config);
  assert.throws(() => generatedReadme(snapshot, stats, { ...config, projects: [{ name: 'missing' }] }));
  const malicious = repo('safe', [], { latestRelease: { tagName: '[bad]|<script>', publishedAt: '2024-02-27T00:00:00Z', url: 'https://github.com/sample/safe/releases/tag/v1' } });
  snapshot.repos = [malicious];
  const readme = generatedDetails(snapshot, stats, config);
  assert.ok(!readme.includes('<script>'));
  assert.ok(readme.includes('&#124;'));
  assert.equal(escape('A&B'), 'A&amp;B');
});
