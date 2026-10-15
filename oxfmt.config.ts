import { defineConfig } from 'oxfmt';

export default defineConfig({
  singleQuote: true,
  sortImports: true,
  ignorePatterns: [
    'pnpm-lock.yaml',
    // Copies kept byte-for-byte in sync with their upstream sources.
    'src/entrypoints/sidepanel/tokens.css',
    'tools/oxlint/anti-slop/**',
  ],
  overrides: [
    // DESIGN.md is generated with double-quoted YAML front matter.
    { files: ['*.md'], options: { singleQuote: false } },
  ],
});
