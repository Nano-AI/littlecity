import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Two projects, one runner:
//   unit  every *.test.ts beside the code, in tests/ and in scenarios/ (Node, fast).
//   e2e   every *.e2e.test.ts: real headless Chromium against a dev server on
//         a free port (tests/helpers/browser.ts).
// `npm test` runs unit, `npm run e2e` runs e2e, `npm run check` runs both.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'node',
            include: ['{src,tests,scenarios,gallery,tools}/**/*.test.ts'],
            exclude: ['**/*.e2e.test.ts', '**/node_modules/**'],
          },
        },
        {
          extends: true,
          test: {
            name: 'e2e',
            environment: 'node',
            include: ['{src,tests,scenarios,gallery,tools}/**/*.e2e.test.ts'],
            exclude: ['**/node_modules/**'],
            testTimeout: 120_000,
            hookTimeout: 120_000,
          },
        },
      ],
    },
  }),
);
