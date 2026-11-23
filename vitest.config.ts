import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // Specification, section 9: at least 90 % in the scoring and normalization code.
      include: ['pipeline/metrics/**', 'pipeline/normalize/**'],
      // File and network wiring: its logic lives in the modules it calls, which are
      // covered; it runs on the real data in every daily run (decision D-035).
      exclude: ['pipeline/normalize/run-normalize.ts'],
      thresholds: { statements: 90, lines: 90, functions: 90, branches: 75 },
      reporter: ['text-summary', 'text'],
    },
  },
});
