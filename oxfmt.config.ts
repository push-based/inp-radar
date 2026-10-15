import { defineConfig } from 'oxfmt';

export default defineConfig({
  printWidth: 80,
  singleQuote: true,
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
    // Keep the double-quoted YAML front matter in DESIGN.md as written.
    { files: ['*.md'], options: { singleQuote: false } },
  ],
});
