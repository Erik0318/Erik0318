import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Same solver as Platane/snk's SVG action, pinned to a release commit.
const revision = 'd8f6715049803e982ee5ff501b6b9b7d5deeb09b';
const bundles = ['index.js', '578.index.js', '642.index.js', '680.index.js'];
const palettes = {
  light: { snake: '#24292f', dots: '#eff1f3,#c6ded6,#8cb9aa,#579483,#326c5e' },
  dark: { snake: '#e6edf3', dots: '#20262e,#2b4a41,#3c6d5c,#639781,#9bc5b5' },
};

const temp = await mkdtemp(join(tmpdir(), 'profile-snake-'));
try {
  const config = JSON.parse(await readFile(join(root, 'profile.config.json'), 'utf8'));
  await Promise.all(bundles.map(async file => {
    const url = `https://raw.githubusercontent.com/Platane/snk/${revision}/svg-only/dist/${file}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Snake bundle download failed (${response.status})`);
    await writeFile(join(temp, file), await response.text());
  }));
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN ||
    execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const outputs = Object.entries(palettes).map(([theme, colors]) =>
    `${join(temp, `snake-${theme}.svg`)}?color_snake=${colors.snake}&color_dots=${colors.dots}&palette=${theme === 'dark' ? 'github-dark' : 'github-light'}`);
  execFileSync(process.execPath, [join(temp, 'index.js')], {
    cwd: temp,
    env: { ...process.env, INPUT_GITHUB_USER_NAME: config.username, INPUT_GITHUB_TOKEN: token,
      GITHUB_TOKEN: token, INPUT_OUTPUTS: outputs.join('\n') },
    timeout: 180_000, maxBuffer: 2 * 1024 * 1024,
    // The token is only in the child environment, never shell arguments or logs.
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const files = [];
  for (const theme of Object.keys(palettes)) {
    let svg = await readFile(join(temp, `snake-${theme}.svg`), 'utf8');
    if (!svg.includes('<svg') || !svg.includes('@keyframes') || svg.includes('<script')) {
      throw new Error('Snake output is missing its SVG animation');
    }
    svg = svg.replace('<svg ', '<svg role="img" aria-labelledby="snake-title snake-desc" ')
      .replace(/(<svg[^>]*>)/, '$1<title id="snake-title">Contribution snake</title><desc id="snake-desc">A snake eats the cells of the GitHub contribution calendar. Refreshed every six hours. A static calendar is shown when reduced motion is enabled.</desc>')
      .replace('</svg>', '<style>@media(prefers-reduced-motion:reduce){*{animation:none!important}.s,.u{display:none}}</style></svg>');
    files.push([join(root, 'assets', `snake-${theme}.svg`), svg]);
  }
  // Only publish after both variants have generated and validated successfully.
  for (const [path, svg] of files) {
    await writeFile(`${path}.tmp`, svg);
    await rename(`${path}.tmp`, path);
  }
  console.log('Generated light and dark contribution snakes.');
} catch (error) {
  console.error(`Snake generation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await rm(temp, { recursive: true, force: true });
}
