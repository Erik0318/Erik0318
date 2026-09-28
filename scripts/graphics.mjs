import { TIME_ZONE } from './time.mjs';

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const count = value => new Intl.NumberFormat('en-US').format(value);
const dayMillis = 86_400_000;
const dateOnly = value => new Date(value).toISOString().slice(0, 10);
export const themes = {
  light: { bg: '#ffffff', fg: '#24292f', muted: '#656d76', line: '#d8dee4', empty: '#eff1f3',
    accent: '#3c796d', fill: '#edf4f0', bars: ['#426b61', '#628477', '#829c90', '#a0b3a5', '#becabd', '#dee3dc'] },
  dark: { bg: '#0d1117', fg: '#e6edf3', muted: '#919aa5', line: '#30363d', empty: '#20262e',
    accent: '#9bc5b5', fill: '#15271f', bars: ['#aecfbe', '#8eaf9f', '#709381', '#567362', '#3e5548', '#2c3c34'] },
};

export function groupWeeks(days) {
  const weeks = new Map();
  for (const day of days) {
    const date = new Date(day.date);
    const monday = dateOnly(date.getTime() - (date.getUTCDay() + 6) % 7 * dayMillis);
    weeks.set(monday, (weeks.get(monday) ?? 0) + day.contributionCount);
  }
  return [...weeks].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

export function repositoryLanguages(snapshot, config) {
  return snapshot.repos.filter(repo => !repo.isArchived && !config.excludeFromLanguages.includes(repo.name))
    .map(repo => ({ name: repo.name, title: config.projects.find(p => p.name === repo.name)?.title ?? repo.name,
      total: repo.languages.edges.reduce((sum, item) => sum + item.size, 0),
      languages: repo.languages.edges.map(edge => ({ name: edge.node.name, bytes: edge.size })) }))
    .filter(repo => repo.total > 0).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)).slice(0, 5);
}

export function renderDashboard(snapshot, stats, themeName, mobile = false, config = { projects: [], excludeFromLanguages: [] }) {
  const t = themes[themeName];
  if (!t) throw new Error('Unknown theme');
  const w = mobile ? 420 : 900, h = mobile ? 1220 : 676;
  const svg = [];
  const text = (x, y, value, size = 12, color = t.muted, extra = '') =>
    svg.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${esc(value)}</text>`);
  const rect = (x, y, width, height, fill, extra = '') =>
    svg.push(`<rect x="${x}" y="${y}" width="${Math.max(0, width)}" height="${Math.max(0, height)}" rx="2" fill="${fill}" ${extra}/>`);
  const line = y => svg.push(`<path d="M24 ${y}H${w - 24}" stroke="${t.line}"/>`);
  const header = (x, y, title, subtitle) => {
    text(x, y, title, 15, t.fg, 'font-weight="600"');
    text(x, y + 21, subtitle, 11);
  };
  const date = new Date(snapshot.updatedAt).toLocaleDateString('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: 'short', day: 'numeric' });
  text(24, 32, 'GitHub activity', 16, t.fg, 'font-weight="600"');
  text(mobile ? 24 : w - 24, mobile ? 54 : 32, `${date} · PT`, 11, t.muted, mobile ? '' : 'text-anchor="end"');
  text(24, mobile ? 78 : 56, 'Activity: 12 mo', 11);
  const metrics = [[stats.total, 'Contributions'], [stats.commits, 'Commits'], [stats.prs, 'Pull requests'],
    [stats.reviews, 'Reviews'], [stats.stars, 'Stars received'], [stats.repos, 'Public repos']];
  metrics.forEach(([value, label], i) => {
    const x = 24 + (i % (mobile ? 3 : 6)) * (mobile ? 126 : 144);
    const y = (mobile ? 118 : 100) + (mobile ? Math.floor(i / 3) * 78 : 0);
    text(x, y, count(value), 31, t.fg, 'font-weight="600"');
    text(x, y + 24, label, 11);
  });
  line(mobile ? 240 : 147);
  [[`${stats.current}d`, 'Current streak'], [`${stats.longest}d`, 'Best streak'],
    [stats.bestDay, 'Best day'], [`${Math.round(stats.active / stats.days.length * 100)}%`, 'Days active']].forEach(([value, label], i) => {
    const x = 24 + i * (mobile ? 96 : 216), y = mobile ? 278 : 185;
    text(x, y, value, 22, t.fg, 'font-weight="600"');
    text(x + (mobile ? 0 : 62), y + (mobile ? 20 : 0), label, mobile ? 10 : 11);
  });
  line(mobile ? 319 : 207);

  // Weekly area graph: exactly the contribution calendar, including partial boundary weeks.
  const historyY = mobile ? 351 : 241;
  header(24, historyY, 'Contribution history', 'Weekly · GitHub calendar');
  const weeks = groupWeeks(stats.days);
  const chart = { x: 50, y: historyY + 55, width: mobile ? 346 : 365, height: 108 };
  const peak = Math.max(1, ...weeks.map(week => week.value));
  const ceiling = Math.ceil(peak / 10) * 10;
  const points = weeks.map((week, i) => [chart.x + i / Math.max(1, weeks.length - 1) * chart.width,
    chart.y + chart.height - week.value / ceiling * chart.height]);
  [0, 0.5, 1].forEach(ratio => {
    const y = chart.y + chart.height * (1 - ratio);
    svg.push(`<path d="M${chart.x} ${y}H${chart.x + chart.width}" stroke="${t.line}" stroke-dasharray="2 5"/>`);
    text(chart.x - 10, y + 4, Math.round(ceiling * ratio), 10, t.muted, 'text-anchor="end"');
  });
  const path = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  svg.push(`<path d="${path} L${chart.x + chart.width} ${chart.y + chart.height} L${chart.x} ${chart.y + chart.height}Z" fill="${t.fill}"/>`);
  svg.push(`<path class="draw" d="${path}" fill="none" stroke="${t.accent}" stroke-width="2" stroke-linejoin="round" pathLength="1"/>`);
  const topWeek = weeks.reduce((best, week, i) => week.value > weeks[best].value ? i : best, 0);
  const [px, py] = points[topWeek];
  svg.push(`<circle cx="${px}" cy="${py}" r="3.5" fill="${t.accent}" stroke="${t.bg}" stroke-width="2"><title>Week of ${weeks[topWeek].date}: ${weeks[topWeek].value} contributions</title></circle>`);
  text(px, py - 11, `${weeks[topWeek].value}`, 11, t.accent, 'text-anchor="middle"');
  const labelIndices = [...new Set([0, Math.floor((weeks.length - 1) / 3), Math.floor((weeks.length - 1) * 2 / 3), weeks.length - 1])];
  for (const i of labelIndices) {
    const label = new Date(weeks[i].date).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    text(points[i][0], chart.y + chart.height + 22, label, 10, t.muted,
      `text-anchor="${i === 0 ? 'start' : i === weeks.length - 1 ? 'end' : 'middle'}"`);
  }

  // Doughnut: the same exact byte weights as the text breakdown, with a stable palette.
  if (mobile) line(548);
  const languageX = mobile ? 24 : 478, languageY = mobile ? 577 : 241;
  header(languageX, languageY, 'Language mix', 'Code bytes');
  const cx = languageX + 72, cy = languageY + 112, radius = 61, circumference = 2 * Math.PI * radius;
  svg.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${t.empty}" stroke-width="18"/>`);
  let angle = 0;
  stats.languages.forEach((language, i) => {
    const length = language.percent / 100 * circumference;
    const gap = Math.min(3, length * .15);
    svg.push(`<circle class="ring" cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${t.bars[i]}" stroke-width="18" stroke-dasharray="${Math.max(0, length - gap).toFixed(3)} ${circumference.toFixed(3)}" stroke-dashoffset="${-angle}" transform="rotate(-90 ${cx} ${cy})"><title>${esc(language.name)}: ${language.percent.toFixed(1)}%</title></circle>`);
    angle += length;
  });
  text(cx, cy, stats.languages.length ? `${stats.languages[0].percent.toFixed(0)}%` : '0%', 25, t.fg, 'text-anchor="middle" font-weight="600"');
  text(cx, cy + 22, stats.languages[0]?.name ?? 'No data', 11, t.muted, 'text-anchor="middle"');
  if (!stats.languages.length) text(languageX, languageY + 199, 'No language data yet.', 11);
  stats.languages.forEach((language, i) => {
    const x = languageX + 166, y = languageY + 57 + i * 24;
    rect(x, y - 8, 7, 7, t.bars[i]);
    text(x + 15, y, language.name, 11, t.fg);
    text(mobile ? 396 : 876, y, `${language.percent.toFixed(1)}%`, 11, t.muted, 'text-anchor="end"');
  });

  line(mobile ? 789 : 451);
  const rhythmY = mobile ? 821 : 486;
  header(24, rhythmY, 'Weekly rhythm', 'GitHub calendar');
  const rhythmWidth = mobile ? 372 : 394, gap = rhythmWidth / 7;
  const maxDay = Math.max(1, ...stats.weekdays), baseline = rhythmY + 125;
  stats.weekdays.forEach((value, i) => {
    const x = 24 + i * gap, height = value / maxDay * 65;
    rect(x + 9, baseline - height, gap - 20, Math.max(1, height), value ? t.accent : t.empty, 'class="bar"');
    text(x + gap / 2, baseline - height - 8, count(value), 10, t.muted, 'text-anchor="middle"');
    text(x + gap / 2, baseline + 20, ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i], 11, t.muted, 'text-anchor="middle"');
  });

  if (mobile) line(991);
  const repoX = mobile ? 24 : 478, repoY = mobile ? 1023 : 486;
  header(repoX, repoY, 'Inside the repositories', 'Code bytes');
  const repos = repositoryLanguages(snapshot, config);
  if (!repos.length) text(repoX, repoY + 65, 'No repository language data yet.', 12);
  const labelWidth = mobile ? 135 : 149, barWidth = mobile ? 178 : 189;
  repos.forEach((repo, row) => {
    const y = repoY + 62 + row * 24;
    const label = repo.title.length > 20 ? repo.title.slice(0, 19) + '…' : repo.title;
    text(repoX, y, label, 11, t.fg);
    let x = repoX + labelWidth;
    repo.languages.forEach(language => {
      const colorIndex = stats.languages.findIndex(item => item.name === language.name);
      const color = t.bars[colorIndex < 0 ? 5 : colorIndex];
      const width = language.bytes / repo.total * barWidth;
      svg.push(`<rect x="${x.toFixed(2)}" y="${y - 9}" width="${width.toFixed(2)}" height="8" fill="${color}"><title>${esc(repo.name)} · ${esc(language.name)}: ${(language.bytes / repo.total * 100).toFixed(1)}%</title></rect>`);
      x += width;
    });
    text(mobile ? 396 : 876, y, `${Math.round(repo.total / 1000)}k`, 10, t.muted, 'text-anchor="end"');
  });
  const description = `${count(stats.total)} contributions, ${count(stats.commits)} commits, ${stats.prs} pull requests, ${stats.reviews} reviews in the past year. ${stats.stars} stars and ${stats.repos} public original repositories. Longest streak ${stats.longest} days. Weekly contribution history, language distribution, weekday activity, and repository code composition.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc">
<title id="title">${esc(snapshot.login)} · GitHub statistics</title><desc id="desc">${esc(description)}</desc>
<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;font-variant-numeric:tabular-nums}.draw{animation:draw 1.8s ease-out both}.bar,.ring{animation:fade 1.2s ease-out both}@keyframes draw{from{stroke-dasharray:1;stroke-dashoffset:1}to{stroke-dasharray:1;stroke-dashoffset:0}}@keyframes fade{from{opacity:.65}to{opacity:1}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}</style>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="10" fill="${t.bg}" stroke="${t.line}"/>
${svg.join('\n')}
</svg>\n`;
}
