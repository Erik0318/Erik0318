import { pointAt, project, TAU } from '../lab/field.mjs';

export function renderScene(theme = 'dark', mobile = false) {
  const dark = theme === 'dark';
  const w = mobile ? 480 : 960, h = mobile ? 640 : 490;
  const cx = mobile ? 240 : 697, cy = mobile ? 360 : 244, scale = mobile ? 132 : 144;
  const p = dark ? { bg: '#101b20', text: '#f2f4e9', muted: '#acbfb9', mint: '#aff1cb', line: '#304543', dot: '#506761' }
    : { bg: '#f1f3e9', text: '#1b3735', muted: '#506963', mint: '#22705a', line: '#ced9ce', dot: '#a5b5a8' };
  const paths = [];
  for (let v = 0; v < 20; v++) {
    const points = Array.from({ length: 161 }, (_, i) => {
      const q = project(pointAt(0, i / 160, v / 20), .5, -.6, scale, cx, cy);
      return `${i ? 'L' : 'M'}${q[0].toFixed(2)} ${q[1].toFixed(2)}`;
    }).join('');
    paths.push(`<path d="${points}" fill="none" stroke="${v % 5 === 0 ? (dark ? '#e6edab' : '#8c6729') : p.mint}" stroke-width="${v % 5 === 0 ? 1.4 : .65}" opacity="${v % 5 === 0 ? .85 : .48}"/>`);
    if (v % 5 === 0) paths.push(`<path class="signal" style="animation-delay:-${v * .9}s" d="${points}" pathLength="1000" fill="none" stroke="${p.text}" stroke-width="2" stroke-linecap="round" stroke-dasharray="8 992"/>`);
  }
  const stars = Array.from({ length: 54 }, (_, i) => {
    const x = 25 + ((i * 167 + 33) % (w - 50)), y = 60 + ((i * 113 + 17) % (h - 155));
    return `<circle class="star" cx="${x}" cy="${y}" r="${i % 4 === 0 ? 1.5 : .8}" fill="${p.mint}" opacity=".3" style="animation-delay:-${i % 7}s"/>`;
  }).join('');
  const orbit = Array.from({ length: 56 }, (_, i) => {
    const a = i / 56 * TAU;
    return `<path d="M${(cx + Math.cos(a) * (scale + 53)).toFixed(2)} ${(cy + Math.sin(a) * (scale + 53) * .83).toFixed(2)}l${(Math.cos(a) * (i % 7 ? 3 : 8)).toFixed(2)} ${(Math.sin(a) * (i % 7 ? 3 : 8)).toFixed(2)}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc">
<title id="title">Signal Garden — Erik's interactive playground</title>
<desc id="desc">A luminous three-dimensional knot floats inside an orbital instrument. Light travels along its woven strands. Open the linked playground to rotate it, bend it with your pointer, and explore four project-inspired forms.</desc>
<defs>
  <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="${p.dot}" opacity=".4"/></pattern>
  <radialGradient id="halo"><stop stop-color="${p.mint}" stop-opacity=".12"/><stop offset="1" stop-color="${p.mint}" stop-opacity="0"/></radialGradient>
  <clipPath id="frame"><rect width="${w}" height="${h}" rx="20"/></clipPath>
</defs>
<style>
text{font-family:Arial,Helvetica,sans-serif}.mono{font-family:Consolas,Menlo,monospace;letter-spacing:1.7px}
.sculpture{transform-origin:${cx}px ${cy}px;animation:float 10s ease-in-out infinite}
.signal{animation:signal 9s linear infinite}.star{animation:shimmer 7s ease-in-out infinite}
.orbit{transform-origin:${cx}px ${cy}px;animation:orbit 90s linear infinite}
@keyframes float{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-9px) rotate(3deg)}}
@keyframes signal{to{stroke-dashoffset:-1000}}@keyframes orbit{to{transform:rotate(360deg)}}
@keyframes shimmer{0%,100%{opacity:.2}50%{opacity:.7}}
@media(prefers-reduced-motion:reduce){*{animation:none!important}.signal{display:none}}
</style>
<g clip-path="url(#frame)">
<rect width="${w}" height="${h}" fill="${p.bg}"/><rect width="${w}" height="${h}" fill="url(#grid)"/>
<circle cx="${cx}" cy="${cy}" r="${scale + 85}" fill="url(#halo)"/>${stars}
<path d="M28 51H${w - 28}" stroke="${p.line}"/>
<circle cx="32" cy="29" r="4" fill="${p.mint}"/><text class="mono" x="46" y="33" font-size="10" fill="${p.muted}">ERIK / EXPERIMENT ${mobile ? '01' : '001'}</text>
<text class="mono" x="${w - 30}" y="33" text-anchor="end" font-size="10" fill="${p.muted}">CREATIVE COMPUTING</text>
<text x="${mobile ? 28 : 42}" y="${mobile ? 105 : 151}" font-size="${mobile ? 42 : 56}" font-weight="700" letter-spacing="-2.5" fill="${p.text}">Signal Garden<tspan fill="${p.mint}">.</tspan></text>
<text x="${mobile ? 30 : 44}" y="${mobile ? 138 : 190}" font-size="${mobile ? 16 : 19}" fill="${p.muted}">A little order. A little beautiful chaos.</text>
${mobile ? '' : `<text x="44" y="234" font-size="14" fill="${p.muted}">Sound becomes shape. Code becomes motion.</text><text x="44" y="258" font-size="14" fill="${p.muted}">Four projects. One living experiment.</text>`}
<g class="orbit" fill="none" stroke="${p.line}">${orbit}</g>
<g class="sculpture">${paths.join('')}</g>
<circle cx="${cx}" cy="${cy}" r="3" fill="${p.text}"/>
<g transform="translate(${mobile ? 119 : 44} ${mobile ? 526 : 306})">
<rect width="242" height="45" rx="23" fill="${p.mint}"/><text x="22" y="28" font-size="13" font-weight="700" letter-spacing="1" fill="${p.bg}">ENTER THE GARDEN</text><path d="M212 17l6 6-6 6m-8-6h14" stroke="${p.bg}" stroke-width="1.8" fill="none"/>
</g>
<path d="M28 ${h - 61}H${w - 28}" stroke="${p.line}"/>
<text class="mono" x="30" y="${h - 31}" font-size="${mobile ? 9 : 11}" fill="${p.muted}">01 SOUND / 02 SILICON / 03 CINEMA / 04 MOTION</text>
${mobile ? '' : `<text class="mono" x="${w - 30}" y="${h - 31}" text-anchor="end" font-size="10" fill="${p.mint}">MOVE. DRAG. DISCOVER. ↗</text>`}
</g></svg>\n`;
}
