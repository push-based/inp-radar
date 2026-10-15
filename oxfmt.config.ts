import { defineConfig } from 'oxfmt';

export default defineConfig({
  singleQuote: true,
  sortImports: true,
  ignorePatterns: [
    '.agent/**',
    '.agents/**',
    '.claude/**',
    '.codex/**',
    '.continue/**',
    '.cursor/**',
    '.gemini/**',
    '.impeccable/**',
    '.opencode/**',
    '.pi/**',
    '.roo/**',
    '.windsurf/**',
    'pnpm-lock.yaml',
    // Copies kept byte-for-byte in sync with their upstream sources.
    'entrypoints/sidepanel/tokens.css',
    'tools/oxlint/anti-slop/**',
  ],
  overrides: [
    // DESIGN.md is generated with double-quoted YAML front matter.
    { files: ['*.md'], options: { singleQuote: false } },
  ],
});
