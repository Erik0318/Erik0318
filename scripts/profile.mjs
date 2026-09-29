import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderDashboard, groupWeeks, repositoryLanguages } from './graphics.mjs';
import { renderProject, projectAsset, divider } from './tiles.mjs';
import { pacificDate, pacificTimestamp } from './time.mjs';
export { renderDashboard };

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

export function generatedReadme(snapshot, stats, config) {
  const tiles = config.projects.map(project => {
    const repo = snapshot.repos.find(repo => repo.name === project.name);
    if (!repo) throw new Error(`Selected project not found: ${project.name}`);
    return `  <a href="${safeUrl(repo.url)}"><picture>
    <source media="(prefers-color-scheme: dark)" srcset="./${projectAsset(project, 'dark')}" />
    <img src="./${projectAsset(project, 'light')}" width="410" alt="${escape(project.title ?? project.name)} — ${escape(project.description)}" />
  </picture></a>`;
  });
  const rows = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push('<p>\n' + tiles.slice(i, i + 2).join('\n') + '\n</p>');
  const projectDetails = config.projects.map(project => {
    const repo = snapshot.repos.find(repo => repo.name === project.name);
    const release = repo.latestRelease && !repo.latestRelease.isDraft && !repo.latestRelease.isPrerelease
      ? `[${markdown(repo.latestRelease.tagName)}](${safeUrl(repo.latestRelease.url)}) · ${pacificDate(repo.latestRelease.publishedAt)}`
      : 'No stable release yet';
    return `**[${markdown(project.title ?? project.name)}](${safeUrl(repo.url)})** — ${markdown(project.description)}\n\n${markdown(project.stack ?? repo.primaryLanguage?.name ?? '')} · ${release}`;
  }).join('\n\n');
  return `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/snake-dark.svg" />
  <img src="./assets/snake-light.svg" width="100%" alt="Animated contribution calendar." />
</picture>

### Selected work

${rows.join('\n\n')}

<details>
<summary>Project details &amp; latest releases</summary>

${projectDetails}

</details>

### Activity

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="./assets/stats-dark-mobile.svg" />
  <source media="(max-width: 600px)" srcset="./assets/stats-light-mobile.svg" />
  <source media="(prefers-color-scheme: dark)" srcset="./assets/stats-dark.svg" />
  <img src="./assets/stats-light.svg" width="100%" alt="${number(stats.total)} contributions, ${number(stats.commits)} commits, ${stats.prs} pull requests. Full data available below." />
</picture>

<sub>[Data](./docs/activity.md) · [↻ 6h](https://github.com/${config.username}/${config.username}/actions/workflows/profile.yml) · ${pacificTimestamp(snapshot.updatedAt)}</sub>

<img src="./assets/profile-footer.svg" width="100%" height="8" alt="" />`;
}

export function generatedDetails(snapshot, stats, config) {
  const projects = config.projects.map(project => {
    const repo = snapshot.repos.find(repo => repo.name === project.name);
    if (!repo) throw new Error(`Selected project not found: ${project.name}`);
    return `| [${markdown(project.title ?? project.name)}](${safeUrl(repo.url)}) | ${markdown(project.description)} | ${markdown(project.stack ?? repo.primaryLanguage?.name ?? '—')} |`;
  });
  const releases = snapshot.repos.filter(repo => repo.latestRelease && !repo.latestRelease.isDraft && !repo.latestRelease.isPrerelease)
    .sort((a, b) => b.latestRelease.publishedAt.localeCompare(a.latestRelease.publishedAt)).slice(0, 3)
    .map(repo => `- **${markdown(repo.name)} [${markdown(repo.latestRelease.tagName)}](${safeUrl(repo.latestRelease.url)})** · ${pacificDate(repo.latestRelease.publishedAt)}`);
  const recent = [...snapshot.repos].filter(repo => !config.excludeFromLanguages.includes(repo.name) && repo.pushedAt)
    .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt)).slice(0, 4)
    .map(repo => `| [${markdown(repo.name)}](${safeUrl(repo.url)}) | ${pacificDate(repo.pushedAt)} | ${repo.stargazerCount} | ${repo.forkCount} |`);
  const history = groupWeeks(stats.days);
  const peakWeek = history.reduce((best, week) => week.value > best.value ? week : best, history[0]);
  const code = repositoryLanguages(snapshot, config);
  return `# Projects

| Project | Engineering work | Built with |
| :--- | :--- | :--- |
${projects.join('\n')}

## Statistics

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
| Most active week | ${peakWeek.value} contributions · week of ${peakWeek.date} |

**Recently pushed repositories**

| Repository | Last push (Pacific) | Stars | Forks |
| :--- | :--- | ---: | ---: |
${recent.join('\n')}

**Latest releases (Pacific dates)**

${releases.length ? releases.join('\n') : 'No public releases yet.'}

**Languages by code size**

${stats.languages.map(lang => `${markdown(lang.name)} ${lang.percent.toFixed(1)}%`).join(' · ') || 'No language data yet.'}

**Repository language composition**

| Repository | Code size | Languages |
| :--- | ---: | :--- |
${code.map(repo => `| ${markdown(repo.title)} | ${number(repo.total)} bytes | ${repo.languages.map(language => `${markdown(language.name)} ${(language.bytes / repo.total * 100).toFixed(1)}%`).join(' · ')} |`).join('\n')}

<sub>Collected ${pacificTimestamp(snapshot.updatedAt)}. Activity covers GitHub calendar dates ${stats.days[0].date} through ${stats.days.at(-1).date}. Stars and repository counts cover public, owned, non-fork repositories. Language percentages use code bytes and exclude archived repositories and this profile. Streaks use calendar days, with today allowed to finish. These numbers describe activity, not proficiency.</sub>

[Methodology and refresh settings](./stats.md)
`;
}

export function replaceSection(readme, content) {
  const start = '<!-- profile:start -->', end = '<!-- profile:end -->';
  if (readme.split(start).length !== 2 || readme.split(end).length !== 2 || readme.indexOf(start) > readme.indexOf(end)) {
    throw new Error('README must contain exactly one ordered profile marker pair');
  }
  return readme.slice(0, readme.indexOf(start) + start.length) + '\n' + content + '\n' + readme.slice(readme.indexOf(end));
}

export function validateProfileViewBadge(readme, username) {
  const match = readme.match(/!\[Profile views\]\(([^)\s]+)\)/);
  if (!match) throw new Error('README must contain a non-empty profile-view badge URL');
  let url;
  try {
    url = new URL(match[1]);
  } catch {
    throw new Error('README profile-view badge URL is invalid');
  }
  const expectedPath = `https://github.com/${username}`.toLowerCase();
  if (match[1].includes('+') || url.protocol !== 'https:' || url.hostname !== 'api.visitorbadge.io' ||
      url.pathname !== '/api/visitors' || url.searchParams.get('path')?.toLowerCase() !== expectedPath) {
    throw new Error('README profile-view badge must use a Camo-safe Visitor Badge URL with the configured profile path');
  }
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
  validateProfileViewBadge(readme, config.username);
  const output = new Map([['README.md', replaceSection(readme, generatedReadme(snapshot, stats, config))]]);
  output.set('docs/activity.md', generatedDetails(snapshot, stats, config));
  output.set('assets/profile-footer.svg', divider);
  for (const project of config.projects) for (const theme of ['light', 'dark']) {
    output.set(projectAsset(project, theme), renderProject(project, theme));
  }
  for (const theme of ['light', 'dark']) for (const mobile of [false, true]) {
    output.set(`assets/stats-${theme}${mobile ? '-mobile' : ''}.svg`, renderDashboard(snapshot, stats, theme, mobile, config));
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
  console.log(`Updated ${output.size} files from ${pacificTimestamp(snapshot.updatedAt)}; ${stats.total} contributions, ${stats.repos} repositories.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`Profile update failed: ${error.message}`);
    process.exitCode = 1;
  });
}
