import { themes } from './graphics.mjs';
import { createHash } from 'node:crypto';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const projectSlug = project => project.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-');

// GitHub strips query parameters from relative raw-image redirects. Put the
// artwork revision in the filename so an old CDN response cannot mask an edit.
export function projectAsset(project, theme) {
  const revision = createHash('sha256').update(renderProject(project, theme)).digest('hex').slice(0, 12);
  return `assets/project-${projectSlug(project)}-${theme}-${revision}.svg`;
}

export function renderProject(project, theme) {
  const t = themes[theme];
  const identity = {
    Suture: ['Suture', ['Import audio. Arrange chapters.', 'Export tracks in the right order.'], 'audio'],
    'tang25k-cpu': ['Tang25K CPU', ['A 16-bit computer on an FPGA.', 'Built for the Tang Primer 25K. In progress.'], 'chip'],
    'Letterboxd-AI-Review': ['Letterboxd analytics', ['Turn your film diary into useful insights.', 'Parse your CSV exports locally.'], 'film'],
    TempoPilot: ['TempoPilot', ['Control video speed from the keyboard.', 'Rebind shortcuts. Keep your own pace.'], 'video'],
  }[project.name] ?? [project.title ?? project.name, ['', ''], 'chip'];
  const label = (x, y, text, extra = '') => `<text x="${x}" y="${y}" ${extra}>${escape(text)}</text>`;
  const node = (x, title, index) => `<rect x="${x}" y="34" width="80" height="42" rx="6" fill="${t.bg}" stroke="${t.line}"/><rect class="stage stage-${index}" x="${x}" y="34" width="80" height="42" rx="6" fill="${t.fill}" stroke="${t.accent}"/>${label(x + 40, 59, title, `text-anchor="middle" fill="${t.fg}" font-size="10" letter-spacing="1"`)}`;
  let drawing = '';
  if (identity[2] === 'audio') {
    drawing = label(0, 12, 'AUDIO / CHAPTERS', 'class="caption"') + label(392, 12, 'WORKFLOW SKETCH', 'class="caption faint" text-anchor="end"');
    for (let i = 0; i < 3; i++) {
      drawing += `<rect x="${i * 132}" y="27" width="128" height="59" rx="4" fill="${t.fill}"/>`;
      drawing += label(i * 132 + 8, 102, `0${i + 1}`, 'class="caption"');
    }
    for (let i = 0; i < 76; i++) {
      const h = 5 + Math.abs(Math.sin(i * .67) * Math.cos(i * .21)) * 37;
      drawing += `<rect x="${7 + i * 5}" y="${(56 - h / 2).toFixed(2)}" width="2.3" height="${h.toFixed(2)}" rx="1" fill="${t.accent}" opacity=".6"/>`;
    }
    drawing += `<g class="playhead"><path d="M6 25v64" stroke="${t.fg}" stroke-width="1.2"/><path d="M2 22h8L6 27Z" fill="${t.fg}"/></g>`;
  } else if (identity[2] === 'chip') {
    drawing = label(0, 12, 'INSTRUCTION FLOW', 'class="caption"') + label(392, 12, 'SIMPLIFIED', 'class="caption faint" text-anchor="end"');
    drawing += `<path d="M40 55H352M352 76v16H40V76" fill="none" stroke="${t.line}"/><path class="trace" d="M40 55H352M352 76v16H40V76" fill="none" stroke="${t.accent}" stroke-dasharray="10 38" stroke-width="1.3"/>`;
    drawing += ['FETCH', 'DECODE', 'EXECUTE', 'WRITE'].map((name, i) => node(i * 104, name, i)).join('');
  } else if (identity[2] === 'film') {
    drawing = label(0, 12, 'CSV → LIBRARY → INSIGHTS', 'class="caption"') + label(392, 12, 'WORKFLOW SKETCH', 'class="caption faint" text-anchor="end"');
    drawing += `<rect x="0" y="29" width="80" height="54" rx="5" fill="${t.fill}" stroke="${t.line}"/>`;
    for (let i = 0; i < 4; i++) drawing += `<path d="M10 ${40 + i * 10}h59" stroke="${t.accent}" opacity="${.8 - i * .13}"/>`;
    drawing += `<path d="M29 30v52M51 30v52" stroke="${t.line}"/><path d="M93 55h53m-5-4 5 4-5 4M244 55h45m-5-4 5 4-5 4" stroke="${t.line}" fill="none"/><path class="trace" d="M93 55h53M244 55h45" stroke="${t.accent}" stroke-dasharray="8 20" fill="none"/>`;
    for (let i = 0; i < 3; i++) drawing += `<rect class="film film-${i}" x="${161 + i * 23}" y="${36 - i * 3}" width="26" height="49" rx="3" fill="${t.fill}" stroke="${t.accent}"/>`;
    const bars = [22, 37, 50, 31, 43, 26];
    bars.forEach((h, i) => { drawing += `<rect class="insight" x="${302 + i * 15}" y="${83 - h}" width="9" height="${h}" rx="2" fill="${t.accent}" opacity="${.4 + i * .1}" style="animation-delay:${i * .12}s"/>`; });
    drawing += label(0, 102, 'EXPORT', 'class="caption"') + label(163, 102, 'PARSE', 'class="caption"') + label(301, 102, 'EXPLORE', 'class="caption"');
  } else {
    drawing = label(0, 12, 'PLAYBACK SPEED', 'class="caption"') + label(392, 12, 'COMPARISON', 'class="caption faint" text-anchor="end"');
    for (let i = 0; i < 2; i++) {
      const y = 40 + i * 36;
      drawing += label(0, y + 4, `${i + 1}×`, `font-size="13" fill="${t.fg}"`);
      drawing += `<path d="M42 ${y}H392" stroke="${t.line}" stroke-width="3" stroke-linecap="round"/><path class="speed-${i}" d="M42 ${y}H392" pathLength="100" stroke="${t.accent}" stroke-width="3" stroke-linecap="round" stroke-dasharray="100"/>`;
      drawing += `<g transform="translate(42 ${y})"><circle class="cursor-${i}" r="4" fill="${t.fg}"/></g>`;
    }
    drawing += label(42, 102, 'SAME CLIP · DIFFERENT PACE', 'class="caption"');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="252" viewBox="0 0 440 252" role="img" aria-labelledby="title desc">
<title id="title">${escape(identity[0])}</title><desc id="desc">${escape(project.description ?? '')} Animated diagram is illustrative, not live application data.</desc>
<style>
text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
.caption{font-family:Consolas,Menlo,monospace;font-size:9px;letter-spacing:.6px;fill:${t.muted}}.faint{opacity:.8}
.playhead{animation:seek 9s linear infinite}.trace{animation:trace 8s linear infinite}
.stage{opacity:.12;animation:stage 8s linear infinite}.stage-1{animation-delay:2s}.stage-2{animation-delay:4s}.stage-3{animation-delay:6s}
.film{animation:film 8s ease-in-out infinite}.film-1{animation-delay:.15s}.film-2{animation-delay:.3s}
.insight{transform-box:fill-box;transform-origin:center bottom;animation:insight 8s ease-in-out infinite}
.speed-0{stroke-dashoffset:35;animation:progress-normal 10s linear infinite}.speed-1{stroke-dashoffset:0;animation:progress-fast 10s linear infinite}
.cursor-0{transform:translateX(227.5px);animation:normal-cursor 10s linear infinite}.cursor-1{transform:translateX(350px);animation:fast-cursor 10s linear infinite}
@keyframes seek{0%,8%{transform:translateX(0)}90%,100%{transform:translateX(378px)}}
@keyframes trace{to{stroke-dashoffset:-96}}
@keyframes stage{0%,22%{opacity:1}25%,97%{opacity:.12}100%{opacity:1}}
@keyframes film{0%,25%,100%{transform:translateY(0)}45%,75%{transform:translateY(-4px)}}
@keyframes insight{0%,20%,100%{transform:scaleY(.7)}45%,80%{transform:scaleY(1)}}
@keyframes progress-normal{0%,10%{stroke-dashoffset:100}90%,100%{stroke-dashoffset:0}}
@keyframes progress-fast{0%,10%{stroke-dashoffset:100}50%,100%{stroke-dashoffset:0}}
@keyframes normal-cursor{0%,10%{transform:translateX(0)}90%,100%{transform:translateX(350px)}}
@keyframes fast-cursor{0%,10%{transform:translateX(0)}50%,100%{transform:translateX(350px)}}
@media(prefers-reduced-motion:reduce){*{animation:none!important}.playhead{transform:translateX(160px)}.stage{opacity:.35}}
</style>
<rect x=".5" y=".5" width="439" height="251" rx="10" fill="${t.bg}" stroke="${t.line}"/>
<text x="24" y="35" font-size="21" font-weight="600" fill="${t.fg}">${escape(identity[0])}</text>
<text x="24" y="60" font-size="13" fill="${t.muted}">${escape(identity[1][0])}</text>
<text x="24" y="79" font-size="13" fill="${t.muted}">${escape(identity[1][1])}</text>
<path d="M413 20h8v8M412 29l9-9" fill="none" stroke="${t.muted}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
<g transform="translate(24 98)">${drawing}</g>
<path d="M24 218H416" stroke="${t.line}"/>
<text x="24" y="239" font-size="11" fill="${t.muted}">${escape(project.stack ?? '')}</text>
</svg>\n`;
}

// Small, unlabeled color accents. No text, iconography, or identity claims.
export const accents = `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="25" viewBox="0 0 88 25">
<defs><clipPath id="a"><rect width="40" height="25" rx="3"/></clipPath><clipPath id="b"><rect x="48" width="40" height="25" rx="3"/></clipPath></defs>
<g clip-path="url(#a)"><path fill="#5BCEFA" d="M0 0h40v5H0zM0 20h40v5H0z"/><path fill="#F5A9B8" d="M0 5h40v5H0zM0 15h40v5H0z"/><path fill="#FFFFFF" d="M0 10h40v5H0z"/></g>
<g clip-path="url(#b)"><path fill="#D60270" d="M48 0h40v10H48z"/><path fill="#9B4F96" d="M48 10h40v5H48z"/><path fill="#0038A8" d="M48 15h40v10H48z"/></g>
</svg>\n`;
