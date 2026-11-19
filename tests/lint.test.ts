// The purity ban and the layer rule are enforced by ESLint (eslint.config.js).
// These tests lint snippets as if they were files in each directory.

import path from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const eslint = new ESLint({ cwd: ROOT });

async function lint(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, file) });
  return result!.messages.filter((m) => m.severity === 2).map((m) => `${m.ruleId}: ${m.message}`);
}

describe('purity lint', () => {
  test('purity lint fails on Math.random in src/rules', async () => {
    const errors = await lint('src/rules/decoration/D99.bad.rule.ts', 'export const x = Math.random();\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/no-restricted-properties.*rand\(seed/);
  });

  test.each(['src/core/x.ts', 'src/terrain/x.ts', 'src/resolve/x.ts', 'src/resolve/facts/x.fact.ts', 'src/gen/house/x.gen.ts', 'src/parts/x.part.ts', 'src/scenario/x.ts'])(
    'Math.random, Date and performance.now are banned in %s',
    async (file) => {
      expect(await lint(file, 'export const a = Math.random();\n')).toHaveLength(1);
      expect(await lint(file, 'export const b = Date.now();\n')).toHaveLength(1);
      expect(await lint(file, 'export const c = new Date();\n')).toHaveLength(1);
      expect(await lint(file, 'export const d = performance.now();\n')).toHaveLength(1);
      expect(await lint(file, 'export const e = document.title;\n')).toHaveLength(1);
      expect(await lint(file, 'export const f = setTimeout(() => {}, 1);\n')).toHaveLength(1);
    },
  );

  test('the clock and the DOM are fine where they belong', async () => {
    const code = 'export const a = performance.now() + Date.now();\nexport const b = document.title;\n';
    expect(await lint('src/life/x.behaviour.ts', code)).toEqual([]);
    expect(await lint('src/render/x.ts', code)).toEqual([]);
    expect(await lint('src/ui/x.ts', code)).toEqual([]);
    expect(await lint('tools/x.ts', code)).toEqual([]);
    // src/world may use timers and storage (autosave), but never chance.
    expect(await lint('src/world/x.ts', 'export const t = setTimeout(() => {}, 500);\n')).toEqual([]);
    expect(await lint('src/world/x.ts', 'export const r = Math.random();\n')).toHaveLength(1);
  });

  test('Three.js: never in logic, maths only in gen and parts', async () => {
    const three = "import { Vector3 } from 'three';\nexport const v = new Vector3();\n";
    expect(await lint('src/resolve/x.ts', three)).toHaveLength(1);
    expect(await lint('src/rules/roles/x.rule.ts', three)).toHaveLength(1);
    expect(await lint('src/world/x.ts', three)).toHaveLength(1);
    expect(await lint('src/gen/house/x.gen.ts', three)).toEqual([]);
    expect(await lint('src/parts/x.part.ts', three)).toEqual([]);
    const addons = "import { OrbitControls } from 'three/addons/controls/OrbitControls.js';\nexport const c = OrbitControls;\n";
    expect(await lint('src/gen/house/x.gen.ts', addons)).toHaveLength(1);
    expect(await lint('src/render/x.ts', addons)).toEqual([]);
  });
});

describe('layer lint', () => {
  const importing = (from: string): string => `import { x } from '${from}';\nexport const y = x;\n`;

  test('a module may not import from a later layer', async () => {
    expect(await lint('src/core/x.ts', importing('@/world/world'))).toHaveLength(1);
    expect(await lint('src/world/x.ts', importing('@/resolve/plan'))).toHaveLength(1);
    expect(await lint('src/resolve/x.ts', importing('@/gen/mesh'))).toHaveLength(1);
    expect(await lint('src/rules/roles/x.rule.ts', importing('@/parts/door.part'))).toHaveLength(1);
    expect(await lint('src/gen/house/x.gen.ts', importing('@/render/index'))).toHaveLength(1);
    expect(await lint('src/parts/x.part.ts', importing('@/life/api'))).toHaveLength(1);
    expect(await lint('src/life/x.ts', importing('@/ui/input'))).toHaveLength(1);
    expect(await lint('src/render/x.ts', importing('@/app/main'))).toHaveLength(1);
  });

  test('earlier layers and the same layer are fine', async () => {
    expect(await lint('src/rules/roles/x.rule.ts', importing('@/resolve/engine/api'))).toEqual([]);
    expect(await lint('src/rules/roles/x.rule.ts', importing('@/core/grid'))).toEqual([]);
    expect(await lint('src/rules/roles/x.rule.ts', importing('@/style/auto'))).toEqual([]);
    expect(await lint('src/gen/house/x.gen.ts', importing('@/resolve/plan'))).toEqual([]);
    expect(await lint('src/parts/x.part.ts', importing('@/gen/mesh'))).toEqual([]);
    expect(await lint('src/life/x.ts', importing('@/gen/mesh'))).toEqual([]);
    expect(await lint('src/render/x.ts', importing('@/life/api'))).toEqual([]);
    expect(await lint('src/app/x.ts', importing('@/render/index'))).toEqual([]);
    expect(await lint('src/terrain/x.ts', importing('@/world/world'))).toEqual([]);
  });
});
