#!/usr/bin/env node
// Headless screenshots (375/768/1280 x dark/light) + axe for a running site.
// Usage (from the target project root): node visual-check.mjs <baseUrl> [path ...]
// Resolves @playwright/test and @axe-core/playwright from the target project, not from this plugin.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [base, ...paths] = process.argv.slice(2);
if (!base) { console.error('usage: visual-check.mjs <baseUrl> [path ...]'); process.exit(2); }
const require = createRequire(join(process.cwd(), 'package.json'));
let chromium, AxeBuilder;
try {
  ({ chromium } = require('@playwright/test'));
  AxeBuilder = require('@axe-core/playwright').default ?? require('@axe-core/playwright').AxeBuilder;
} catch (e) {
  console.error('Install in the target project: npm i -D @playwright/test @axe-core/playwright && npx playwright install chromium');
  process.exit(2);
}

const widths = [375, 768, 1280];
const themes = ['dark', 'light'];
const out = 'qa-output';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const axeReport = {};
let violations = 0;

for (const p of paths.length ? paths : ['/']) {
  const slug = p.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
  for (const theme of themes) {
    for (const width of widths) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      const page = await ctx.newPage();
      await page.goto(new URL(p, base).href, { waitUntil: 'networkidle' });
      if (theme === 'light') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
      await page.screenshot({ path: join(out, `${slug}-${width}-${theme}.png`), fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) console.log(`WARN ${slug} ${width} ${theme}: horizontal scroll`);
      if (width === 1280) {
        const r = await new AxeBuilder({ page }).analyze();
        axeReport[`${slug}-${theme}`] = r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
        violations += r.violations.length;
      }
      await ctx.close();
    }
  }
}
await browser.close();
writeFileSync(join(out, 'axe.json'), JSON.stringify(axeReport, null, 2));
console.log(`done: ${Object.keys(axeReport).length} axe runs, ${violations} violation types -> ${out}/`);
process.exit(violations ? 1 : 0);
