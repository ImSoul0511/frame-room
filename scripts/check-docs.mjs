import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
function markdownFiles(path) {
  if (statSync(path).isFile()) return path.endsWith('.md') ? [path] : [];
  return readdirSync(path).flatMap((name) => markdownFiles(resolve(path, name)));
}
const files = ['README.md', 'docs', 'agents', 'plans', '.github/pull_request_template.md'].flatMap(
  (name) => markdownFiles(resolve(root, name)),
);
const errors = [];
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  // This catches untranslated Vietnamese; manual review still establishes prose quality.
  if (/[ĂăÂâĐđÊêÔôƠơƯư\u1EA0-\u1EF9]/u.test(content))
    errors.push(`${file}: untranslated Vietnamese documentation`);
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1];
    if (/^(?:https?:|mailto:|<)/.test(href)) continue;
    const [path, fragment] = href.split('#');
    const target = path ? resolve(dirname(file), decodeURIComponent(path)) : file;
    if (!existsSync(target)) {
      errors.push(`${file}: missing ${href}`);
      continue;
    }
    if (fragment && target.endsWith('.md')) {
      const headings = [...readFileSync(target, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)].map(
        (heading) =>
          heading[1]
            .toLowerCase()
            .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
            .replace(/\s/g, '-'),
      );
      if (!headings.includes(fragment)) errors.push(`${file}: missing heading ${href}`);
    }
  }
}
if (errors.length) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else
  process.stdout.write(
    `Checked ${files.length} Markdown files: local links and translation scan passed.\n`,
  );
