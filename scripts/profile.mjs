import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DAY = 86_400_000;
const iso = date => new Date(date).toISOString().slice(0, 10);
const number = value => new Intl.NumberFormat('en-US').format(value);
export const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const markdown = value => escape(value).replace(/[\[\]`|\\]/g, c => `&#${c.charCodeAt(0)};`).replace(/\s+/g, ' ');
const safeUrl = value => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') throw new Error('Unexpected repository URL');
  return url.href.replace(/[()]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
};

const repoFields = `name url description isArchived stargazerCount forkCount pushedAt
  primaryLanguage { name color }
  languages(first: 100, orderBy: {field: SIZE, direction: DESC}) {
    totalSize edges { size node { name color } } pageInfo { hasNextPage }
  }
  latestRelease { name tagName publishedAt url isPrerelease isDraft }`;

// Argument arrays avoid shell interpolation. Neither queries nor snapshots contain tokens.
export function github(query, variables) {
  const response = JSON.parse(execFileSync('gh', ['api', 'graphql', '--input', '-'], {
    input: JSON.stringify({ query, variables }), encoding: 'utf8', timeout: 60_000,
    maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
  }));
  if (response.errors?.length) throw new Error(response.errors.map(e => e.message).join('; '));
  if (!response.data?.user) throw new Error('GitHub returned no user data');
  return response.data.user;
}

export async function collect(config, now = new Date()) {
  const from = `${iso(now.getTime() - 364 * DAY)}T00:00:00Z`;
  const variables = { login: config.username, from, to: now.toISOString(), cursor: null };
  const user = github(`query($login: String!, $from: DateTime!, $to: DateTime!, $cursor: String) {
    user(login: $login) {
      login
      contributionsCollection(from: $from, to: $to) {
        startedAt endedAt totalCommitContributions totalIssueContributions
        totalPullRequestContributions totalPullRequestReviewContributions
        contributionCalendar { totalContributions weeks { contributionDays { date weekday contributionCount } } }
      }
      repositories(first: 100, after: $cursor, privacy: PUBLIC, ownerAffiliations: OWNER,
        isFork: false, orderBy: {field: NAME, direction: ASC}) {
        nodes { ${repoFields} } pageInfo { hasNextPage endCursor }
      }
    }
  }`, variables);
  const repos = [...user.repositories.nodes];
  let page = user.repositories.pageInfo;
  while (page.hasNextPage) {
    if (!page.endCursor || page.endCursor === variables.cursor) throw new Error('Repository pagination stalled');
    variables.cursor = page.endCursor;
    const next = github(`query($login: String!, $cursor: String) {
      user(login: $login) {
        repositories(first: 100, after: $cursor, privacy: PUBLIC, ownerAffiliations: OWNER,
          isFork: false, orderBy: {field: NAME, direction: ASC}) {
          nodes { ${repoFields} } pageInfo { hasNextPage endCursor }
        }
      }
    }`, { login: variables.login, cursor: variables.cursor });
    repos.push(...next.repositories.nodes);
    page = next.repositories.pageInfo;
  }
  if (repos.some(repo => repo.languages.pageInfo.hasNextPage)) throw new Error('Language pagination needs expansion; refusing incomplete statistics');
  // Store only the allowlisted public fields above; never a raw account response.
  return { schemaVersion: 1, updatedAt: now.toISOString(), login: user.login,
    contributions: user.contributionsCollection, repos };
}

export function analyze(snapshot, config) {
  if (snapshot.schemaVersion !== 1 || snapshot.login !== config.username) throw new Error('Snapshot/config mismatch');
  const collection = snapshot.contributions;
  const calendar = collection.contributionCalendar;
  const today = iso(snapshot.updatedAt);
  const start = iso(collection.startedAt);
  const days = calendar.weeks.flatMap(week => week.contributionDays)
    .filter(day => day.date >= start && day.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Set();
  for (const day of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || iso(day.date) !== day.date ||
        !Number.isSafeInteger(day.contributionCount) || day.contributionCount < 0 || seen.has(day.date)) {
      throw new Error('Invalid or duplicate contribution day');
    }
    seen.add(day.date);
  }
  const expected = Math.round((Date.parse(today) - Date.parse(start)) / DAY) + 1;
  if (days.length !== expected || days.reduce((sum, d) => sum + d.contributionCount, 0) !== calendar.totalContributions) {
    throw new Error('Incomplete contribution calendar; preserving existing output');
  }
  let longest = 0, run = 0, active = 0;
  const weekdays = Array(7).fill(0);
  for (const day of days) {
    run = day.contributionCount ? run + 1 : 0;
    longest = Math.max(longest, run);
    active += Number(day.contributionCount > 0);
    weekdays[(new Date(day.date).getUTCDay() + 6) % 7] += day.contributionCount;
  }
  let current = 0;
  let index = days.length - 1;
  // An unfinished UTC day does not break yesterday's streak.
  if (days[index]?.date === today && days[index]?.contributionCount === 0) index--;
  for (; index >= 0 && days[index].contributionCount > 0; index--) current++;
  const languageMap = new Map();
  for (const repo of snapshot.repos) {
    if (repo.isArchived || config.excludeFromLanguages.includes(repo.name)) continue;
    for (const { size, node } of repo.languages.edges) {
      languageMap.set(node.name, (languageMap.get(node.name) ?? 0) + size);
    }
  }
  const totalBytes = [...languageMap.values()].reduce((sum, size) => sum + size, 0);
  const ranked = [...languageMap].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const languages = ranked.slice(0, 5).map(([name, bytes]) => ({ name, bytes, percent: totalBytes ? bytes / totalBytes * 100 : 0 }));
  if (ranked.length > 5) {
    const bytes = ranked.slice(5).reduce((sum, entry) => sum + entry[1], 0);
    languages.push({ name: 'Other', bytes, percent: bytes / totalBytes * 100 });
  }
  return { days, current, longest, active, weekdays, languages,
    bestDay: Math.max(0, ...days.map(day => day.contributionCount)),
    total: calendar.totalContributions,
    commits: collection.totalCommitContributions,
    prs: collection.totalPullRequestContributions,
    reviews: collection.totalPullRequestReviewContributions,
    issues: collection.totalIssueContributions,
    stars: snapshot.repos.reduce((sum, repo) => sum + repo.stargazerCount, 0),
    forks: snapshot.repos.reduce((sum, repo) => sum + repo.forkCount, 0),
    repos: snapshot.repos.length,
  };
}

const themes = {
  light: { bg: '#ffffff', fg: '#24292f', muted: '#656d76', line: '#d8dee4', empty: '#eff1f3',
    accent: '#3c796d', scale: ['#eff1f3', '#c6ded6', '#8cb9aa', '#579483', '#326c5e'],
    bars: ['#426b61', '#628477', '#829c90', '#a0b3a5', '#becabd', '#dee3dc'] },
  dark: { bg: '#0d1117', fg: '#e6edf3', muted: '#919aa5', line: '#30363d', empty: '#20262e',
    accent: '#9bc5b5', scale: ['#20262e', '#2b4a41', '#3c6d5c', '#639781', '#9bc5b5'],
    bars: ['#aecfbe', '#8eaf9f', '#709381', '#567362', '#3e5548', '#2c3c34'] },
};

export function renderDashboard(snapshot, stats, themeName, mobile = false) {
  const t = themes[themeName];
  if (!t) throw new Error('Unknown theme');
  const w = mobile ? 420 : 900, h = mobile ? 1000 : 606;
  const parts = [];
  const text = (x, y, value, size = 13, color = t.muted, attrs = '') =>
    parts.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${attrs}>${escape(value)}</text>`);
  const rect = (x, y, width, height, fill, extra = '') =>
    parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="2" fill="${fill}" ${extra}/>`);
  const line = (x1, y, x2) => parts.push(`<path d="M${x1} ${y}H${x2}" stroke="${t.line}"/>`);
  const header = (x, y, title, caption) => {
    text(x, y, title, 15, t.fg, 'font-weight="600"');
    if (caption) text(x, y + 21, caption, 12);
  };
  const metrics = [[stats.total, 'Contributions'], [stats.commits, 'Commits'], [stats.prs, 'Pull requests'],
    [stats.reviews, 'Reviews'], [stats.stars, 'Stars received'], [stats.repos, 'Public repos']];
  const date = new Date(snapshot.updatedAt).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });
  text(24, 32, 'GitHub, in numbers', 16, t.fg, 'font-weight="600"');
  text(mobile ? 24 : w - 24, mobile ? 54 : 32, `Updated ${date}`, 12, t.muted, mobile ? '' : 'text-anchor="end"');
  text(24, mobile ? 80 : 57, 'Activity: past year · repositories / stars: all time', mobile ? 11 : 12);
  for (let i = 0; i < metrics.length; i++) {
    const x = 24 + (i % (mobile ? 3 : 6)) * (mobile ? 126 : 144);
    const y = (mobile ? 122 : 101) + (mobile ? Math.floor(i / 3) * 78 : 0);
    text(x, y, number(metrics[i][0]), 31, t.fg, 'font-weight="600" class="metric"');
    text(x, y + 24, metrics[i][1], mobile ? 11 : 12);
  }
  line(24, mobile ? 249 : 147, w - 24);

  const calTop = mobile ? 280 : 181;
  header(24, calTop, 'Contribution calendar', mobile ? 'Last 26 weeks · UTC' : 'Past year · UTC');
  const weeks = mobile ? snapshot.contributions.contributionCalendar.weeks.slice(-26) : snapshot.contributions.contributionCalendar.weeks;
  const cell = mobile ? 10 : 12;
  const step = mobile ? 13 : Math.min(15, 802 / weeks.length);
  const left = mobile ? 54 : 63, top = calTop + 55;
  const max = Math.max(1, stats.bestDay);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let month = '', lastLabelX = -Infinity;
  weeks.forEach((week, col) => {
    const inRange = week.contributionDays.filter(d => d.date >= stats.days[0].date && d.date <= iso(snapshot.updatedAt));
    const first = inRange[0];
    if (!first) return;
    const currentMonth = first.date.slice(0, 7);
    const x = left + col * step;
    if (currentMonth !== month && x - lastLabelX > 35 && x < w - 47) {
      text(x, top - 10, monthNames[Number(first.date.slice(5, 7)) - 1], 10);
      lastLabelX = x;
    }
    month = currentMonth;
    inRange.forEach(day => {
      const level = day.contributionCount ? Math.min(4, Math.ceil(Math.sqrt(day.contributionCount / max) * 4)) : 0;
      const y = top + new Date(day.date).getUTCDay() * step;
      parts.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${t.scale[level]}"><title>${day.date}: ${number(day.contributionCount)} contributions</title></rect>`);
    });
  });
  ['Mon', 'Wed', 'Fri'].forEach((day, i) => text(24, top + (i * 2 + 1) * step + 9, day, 10));
  const legendY = top + 7 * step + 16;
  text(24, legendY + 8, `${stats.active} active days in the past year`, mobile ? 10 : 12);
  text(w - 149, legendY + 8, 'Less', 10);
  t.scale.forEach((fill, i) => rect(w - 120 + i * 13, legendY, 10, 10, fill));
  text(w - 48, legendY + 8, 'More', 10);

  const streakTop = mobile ? 490 : 406;
  const streaks = [[`${stats.current}d`, 'Current streak'], [`${stats.longest}d`, 'Longest streak'],
    [number(stats.bestDay), 'Best day'], [`${Math.round(stats.active / stats.days.length * 100)}%`, 'Days active']];
  streaks.forEach(([value, label], i) => {
    const x = 24 + (i % (mobile ? 2 : 4)) * (mobile ? 198 : 216);
    const y = streakTop + (mobile ? Math.floor(i / 2) * 64 : 0);
    text(x, y, value, 22, t.fg, 'font-weight="600"');
    text(x + (mobile ? 0 : 63), y + (mobile ? 20 : 0), label, 12);
  });
  line(24, mobile ? 600 : 432, w - 24);

  const lowerTop = mobile ? 633 : 463;
  header(24, lowerTop, 'Languages', 'Share of code bytes · original, active repositories');
  const languageWidth = mobile ? 372 : 397;
  let offset = 24;
  stats.languages.forEach((lang, i) => {
    const width = lang.percent / 100 * languageWidth;
    rect(offset.toFixed(2), lowerTop + 38, width.toFixed(2), 7, t.bars[i]);
    offset += width;
  });
  if (!stats.languages.length) text(24, lowerTop + 60, 'No language data yet.');
  stats.languages.forEach((lang, i) => {
    const x = 24 + i % 2 * (mobile ? 198 : 211);
    const y = lowerTop + 72 + Math.floor(i / 2) * 24;
    rect(x, y - 8, 7, 7, t.bars[i]);
    text(x + 15, y, lang.name, 12, t.fg);
    text(x + (mobile ? 174 : 186), y, `${lang.percent.toFixed(1)}%`, 12, t.muted, 'text-anchor="end"');
  });

  const rhythmX = mobile ? 24 : 478, rhythmY = mobile ? 810 : lowerTop;
  if (mobile) line(24, 780, w - 24);
  header(rhythmX, rhythmY, 'Weekly rhythm', 'Contributions by weekday · past year, UTC');
  const rhythmWidth = mobile ? 372 : 398, gap = rhythmWidth / 7;
  const peak = Math.max(1, ...stats.weekdays);
  stats.weekdays.forEach((value, i) => {
    const x = rhythmX + i * gap;
    const baseline = rhythmY + 102;
    const height = value / peak * 45;
    rect(x + 9, baseline - height, gap - 20, Math.max(1, height), value ? t.accent : t.empty, 'class="bar"');
    text(x + gap / 2, baseline - height - 8, number(value), 10, t.muted, 'text-anchor="middle"');
    text(x + gap / 2, baseline + 20, ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i], 11, t.muted, 'text-anchor="middle"');
  });
  if (mobile) text(24, 976, 'Generated from GitHub data. Refreshed daily.', 11);
  const description = `${number(stats.total)} contributions, ${number(stats.commits)} commits, ${stats.prs} pull requests, ${stats.reviews} reviews in the past year. ${stats.stars} stars and ${stats.repos} public original repositories. Longest streak ${stats.longest} days. Updated ${date}.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc">
<title id="title">${escape(snapshot.login)} · GitHub statistics</title>
<desc id="desc">${escape(description)}</desc>
<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;font-variant-numeric:tabular-nums}.bar{animation:appear .8s ease-out both}@keyframes appear{from{opacity:.7}to{opacity:1}}@media(prefers-reduced-motion:reduce){.bar{animation:none}}</style>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="10" fill="${t.bg}" stroke="${t.line}"/>
${parts.join('\n')}
</svg>\n`;
}

export function generatedReadme(snapshot, stats, config) {
  const projects = config.projects.map(project => {
    const repo = snapshot.repos.find(repo => repo.name === project.name);
    if (!repo) throw new Error(`Selected project not found: ${project.name}`);
    return `| [${markdown(project.title ?? project.name)}](${safeUrl(repo.url)}) | ${markdown(project.description)} | ${markdown(project.stack ?? repo.primaryLanguage?.name ?? '—')} |`;
  });
  const releases = snapshot.repos.filter(repo => repo.latestRelease && !repo.latestRelease.isDraft && !repo.latestRelease.isPrerelease)
    .sort((a, b) => b.latestRelease.publishedAt.localeCompare(a.latestRelease.publishedAt)).slice(0, 3)
    .map(repo => `- **${markdown(repo.name)} [${markdown(repo.latestRelease.tagName)}](${safeUrl(repo.latestRelease.url)})** · ${iso(repo.latestRelease.publishedAt)}`);
  const recent = [...snapshot.repos].filter(repo => !config.excludeFromLanguages.includes(repo.name) && repo.pushedAt)
    .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt)).slice(0, 4)
    .map(repo => `| [${markdown(repo.name)}](${safeUrl(repo.url)}) | ${iso(repo.pushedAt)} | ${repo.stargazerCount} | ${repo.forkCount} |`);
  return `### Projects

| Project | Engineering work | Built with |
| :--- | :--- | :--- |
${projects.join('\n')}

### GitHub activity

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="./assets/stats-dark-mobile.svg" />
  <source media="(max-width: 600px)" srcset="./assets/stats-light-mobile.svg" />
  <source media="(prefers-color-scheme: dark)" srcset="./assets/stats-dark.svg" />
  <img src="./assets/stats-light.svg" width="100%" alt="${number(stats.total)} contributions, ${number(stats.commits)} commits, ${stats.prs} pull requests, ${stats.stars} stars, and ${stats.repos} public repositories. More statistics are available as text below." />
</picture>

<details>
<summary>More stats &amp; recent releases</summary>

| Past year | |
| :--- | ---: |
| Contributions | ${number(stats.total)} |
| Commit contributions | ${number(stats.commits)} |
| Pull requests opened | ${stats.prs} |
| Pull request reviews | ${stats.reviews} |
| Issues opened | ${stats.issues} |
| Active days | ${stats.active} / ${stats.days.length} |
| Current / longest streak | ${stats.current} / ${stats.longest} days |
| Most contributions in a day | ${stats.bestDay} |

**Recently pushed repositories**

| Repository | Last push (UTC) | Stars | Forks |
| :--- | :--- | ---: | ---: |
${recent.join('\n')}

**Latest releases**

${releases.length ? releases.join('\n') : 'No public releases yet.'}

**Languages by code size**

${stats.languages.map(lang => `${markdown(lang.name)} ${lang.percent.toFixed(1)}%`).join(' · ') || 'No language data yet.'}

<sub>Activity covers ${iso(snapshot.contributions.startedAt)} through ${iso(snapshot.updatedAt)} (UTC). Stars and repository counts cover public, owned, non-fork repositories. Language percentages use code bytes and exclude archived repositories and this profile. Streaks use calendar days, with today allowed to finish. These numbers describe activity, not proficiency.</sub>

</details>

<sub>Updated ${iso(snapshot.updatedAt)} · [How these stats work](./docs/stats.md)</sub>`;
}

export function replaceSection(readme, content) {
  const start = '<!-- profile:start -->', end = '<!-- profile:end -->';
  if (readme.split(start).length !== 2 || readme.split(end).length !== 2 || readme.indexOf(start) > readme.indexOf(end)) {
    throw new Error('README must contain exactly one ordered profile marker pair');
  }
  return readme.slice(0, readme.indexOf(start) + start.length) + '\n' + content + '\n' + readme.slice(readme.indexOf(end));
}

async function atomicWrite(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, content);
  await rename(temporary, path);
}

export async function main(args = process.argv.slice(2)) {
  if (args.some(arg => !['--refresh', '--check'].includes(arg)) || args.includes('--refresh') && args.includes('--check')) {
    throw new Error('Usage: node scripts/profile.mjs [--refresh | --check]');
  }
  const config = JSON.parse(await readFile(resolve(ROOT, 'profile.config.json'), 'utf8'));
  const snapshot = args.includes('--refresh') ? await collect(config) : JSON.parse(await readFile(resolve(ROOT, 'data/profile.json'), 'utf8'));
  const stats = analyze(snapshot, config);
  const readmePath = resolve(ROOT, 'README.md');
  const readme = await readFile(readmePath, 'utf8');
  const output = new Map([['README.md', replaceSection(readme, generatedReadme(snapshot, stats, config))]]);
  for (const theme of ['light', 'dark']) for (const mobile of [false, true]) {
    output.set(`assets/stats-${theme}${mobile ? '-mobile' : ''}.svg`, renderDashboard(snapshot, stats, theme, mobile));
  }
  // Finish all API calls, validation, and rendering before replacing anything.
  if (args.includes('--check')) {
    for (const [file, content] of output) {
      if (await readFile(resolve(ROOT, file), 'utf8') !== content) throw new Error(`Generated file out of date: ${file}`);
    }
    console.log('Generated files match the committed snapshot.');
    return;
  }
  if (args.includes('--refresh')) output.set('data/profile.json', JSON.stringify(snapshot, null, 2) + '\n');
  for (const [file, content] of output) await atomicWrite(resolve(ROOT, file), content);
  console.log(`Updated ${output.size} files from ${snapshot.updatedAt}; ${stats.total} contributions, ${stats.repos} repositories.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`Profile update failed: ${error.message}`);
    process.exitCode = 1;
  });
}
