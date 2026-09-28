import { themes } from './graphics.mjs';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const projectSlug = project => project.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-');

export function renderProject(project, theme) {
  const t = themes[theme];
  const identity = {
    Suture: ['Suture', 'Rust / egui / FFmpeg', 'audio'],
    'tang25k-cpu': ['Tang25K', 'Verilog / FPGA', 'chip'],
    'Letterboxd-AI-Review': ['Letterboxd', 'TypeScript / React', 'film'],
    TempoPilot: ['TempoPilot', 'JavaScript / WebExtensions', 'video'],
  }[project.name] ?? [project.title ?? project.name, project.stack ?? '', 'chip'];
  let drawing = '';
  if (identity[2] === 'audio') {
    drawing = Array.from({ length: 13 }, (_, i) => {
      const height = [8, 14, 28, 46, 30, 18, 40, 52, 34, 20, 28, 14, 8][i];
      return `<rect class="wave" x="${306 + i * 7}" y="${56 - height / 2}" width="3" height="${height}" rx="1.5" fill="${t.accent}" style="animation-delay:${i * -.13}s"/>`;
    }).join('');
  } else if (identity[2] === 'chip') {
    drawing = `<rect x="329" y="33" width="46" height="46" rx="7" fill="${t.fill}" stroke="${t.accent}"/><rect x="342" y="46" width="20" height="20" rx="3" stroke="${t.accent}" fill="none"/>`;
    for (let i = 0; i < 4; i++) {
      const p = 339 + i * 9, q = 43 + i * 9;
      drawing += `<path d="M${p} 22V33M${p} 79V90M318 ${q}H329M375 ${q}H386" stroke="${t.muted}" stroke-linecap="round"/>`;
    }
    drawing += `<path class="trace" d="M301 56H329M375 56H407" fill="none" stroke="${t.accent}" stroke-width="2" stroke-dasharray="4 20"/>`;
  } else if (identity[2] === 'film') {
    drawing = `<g class="frames"><rect x="307" y="30" width="91" height="53" rx="5" fill="none" stroke="${t.accent}"/>`;
    for (let i = 0; i < 3; i++) drawing += `<rect x="${316 + i * 25}" y="42" width="20" height="29" rx="2" fill="${t.fill}" stroke="${t.accent}" opacity="${.45 + i * .2}"/>`;
    for (let i = 0; i < 7; i++) drawing += `<path d="M${314 + i * 12} 35h4M${314 + i * 12} 78h4" stroke="${t.muted}" stroke-width="2"/>`;
    drawing += '</g>';
  } else {
    drawing = `<circle cx="352" cy="56" r="31" stroke="${t.line}" fill="none"/><circle class="dial" cx="352" cy="56" r="31" stroke="${t.accent}" stroke-width="2" stroke-dasharray="37 158" fill="none"/><path d="M346 44L364 56L346 68Z" fill="${t.accent}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="112" viewBox="0 0 440 112" role="img" aria-labelledby="title desc">
<title id="title">${escape(identity[0])}</title><desc id="desc">${escape(project.description ?? identity[1])}</desc>
<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}.wave{transform-box:fill-box;transform-origin:center;animation:wave 2.8s ease-in-out infinite}.trace{animation:trace 4s linear infinite}.frames{animation:frames 5s ease-in-out infinite}.dial{transform-origin:352px 56px;animation:dial 12s linear infinite}@keyframes wave{0%,100%{transform:scaleY(.55)}50%{transform:scaleY(1)}}@keyframes trace{to{stroke-dashoffset:-48}}@keyframes frames{0%,100%{transform:translateX(-2px)}50%{transform:translateX(2px)}}@keyframes dial{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}</style>
<rect x=".5" y=".5" width="439" height="111" rx="10" fill="${t.bg}" stroke="${t.line}"/>
<text x="24" y="47" font-size="21" font-weight="600" fill="${t.fg}">${escape(identity[0])}</text>
<text x="24" y="74" font-size="12" fill="${t.muted}">${escape(identity[1])}</text>
<path d="M413 20h8v8M412 29l9-9" fill="none" stroke="${t.muted}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
${drawing}
</svg>\n`;
}

// Small, unlabeled color accents. No text, iconography, or identity claims.
export const accents = `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="6" viewBox="0 0 88 6">
<defs><clipPath id="a"><rect width="40" height="6" rx="3"/></clipPath><clipPath id="b"><rect x="48" width="40" height="6" rx="3"/></clipPath></defs>
<g clip-path="url(#a)"><path fill="#5BCEFA" d="M0 0h8v6H0zM32 0h8v6h-8z"/><path fill="#F5A9B8" d="M8 0h8v6H8zM24 0h8v6h-8z"/><path fill="#FFFFFF" d="M16 0h8v6h-8z"/></g>
<g clip-path="url(#b)"><path fill="#D60270" d="M48 0h16v6H48z"/><path fill="#9B4F96" d="M64 0h8v6h-8z"/><path fill="#0038A8" d="M72 0h16v6H72z"/></g>
</svg>\n`;
