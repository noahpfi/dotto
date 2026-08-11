// fails build when dist/ leaks env data
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist/assets/', import.meta.url);

// substrings forbidden in shipped assets, with reasons
const FORBIDDEN = [
  // surviving VITE_ name = Vite emitted env object
  ['VITE_', 'an env variable name, meaning Vite emitted the env object rather than inlining values'],
  ['VERCEL_GIT_COMMIT', 'git commit metadata'],
  ['VERCEL_OIDC_TOKEN', 'deployment token'],
  ['-----BEGIN', 'a private key'],
];

let files;
try {
  files = readdirSync(DIST).filter((f) => f.endsWith('.js') || f.endsWith('.css'));
} catch {
  console.error('check-bundle: dist/assets not found — run the build first');
  process.exit(1);
}

if (files.length === 0) {
  console.error('check-bundle: no built assets found in dist/assets');
  process.exit(1);
}

const failures = [];
for (const file of files) {
  const source = readFileSync(join(DIST.pathname, file), 'utf8');
  for (const [needle, why] of FORBIDDEN) {
    if (source.includes(needle)) failures.push(`  ${file}: contains "${needle}" — ${why}`);
  }
}

if (failures.length > 0) {
  console.error('check-bundle: forbidden content in shipped assets\n' + failures.join('\n'));
  console.error(
    '\nMost likely cause: an `import.meta.env[variable]` access somewhere. Vite can only replace\n' +
      'literal accesses, so a dynamic key makes it inline the whole env object. Use\n' +
      "envOr(import.meta.env.VITE_THING, fallback) — pass the value, never the name.",
  );
  process.exit(1);
}

console.log(`check-bundle: ${files.length} assets clean`);
