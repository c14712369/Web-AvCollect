import nextPlugin from '@next/eslint-plugin-next';
import tsParser from '@typescript-eslint/parser';

// 規則表見 CLAUDE.md「規則 ↔ 強制機制」。例外寫在該行上方：
// // eslint-disable-next-line no-restricted-syntax -- 原因｜到期 YYYY-MM-DD｜核准：<人>

const EMPTY_FALLBACK_MSG =
  '讀取失敗不可回傳空陣列/空物件/FALLBACK 當預設值（2026-09-21 收藏洗空事故：前端把它當「沒資料」，下一次寫入就洗掉真資料）。' +
  '請 throw，或回 5xx + { success: false }，讓呼叫端進 error 狀態。範例：src/lib/config.ts getConfig、src/app/api/favorites/route.ts GET。';
const FALLBACK_NAME = '/FALLBACK|DEFAULT|EMPTY/';

const emptyFallbackSelectors = [
  // try { ... } catch { return []; } / return {};
  'CatchClause ReturnStatement > ArrayExpression[elements.length=0]',
  'CatchClause ReturnStatement > ObjectExpression[properties.length=0]',
  `CatchClause ReturnStatement > Identifier[name=${FALLBACK_NAME}]`,
  // catch 裡 NextResponse.json([], { status: 500 })（收藏事故原始寫法）
  'CatchClause CallExpression[callee.property.name="json"] > ArrayExpression[elements.length=0]',
  // promise.catch(() => []) / .catch(() => ({})) / .catch(() => FALLBACK)
  'CallExpression[callee.property.name="catch"] > ArrowFunctionExpression > ArrayExpression[elements.length=0]',
  'CallExpression[callee.property.name="catch"] > ArrowFunctionExpression > ObjectExpression[properties.length=0]',
  `CallExpression[callee.property.name="catch"] > ArrowFunctionExpression[body.type="Identifier"][body.name=${FALLBACK_NAME}]`,
  'CallExpression[callee.property.name="catch"] > :function ReturnStatement > ArrayExpression[elements.length=0]',
  'CallExpression[callee.property.name="catch"] > :function ReturnStatement > ObjectExpression[properties.length=0]',
  `CallExpression[callee.property.name="catch"] > :function ReturnStatement > Identifier[name=${FALLBACK_NAME}]`,
  // if (!res.ok) return [];
  'IfStatement[test.operator="!"][test.argument.property.name="ok"] ReturnStatement > ArrayExpression[elements.length=0]',
  'IfStatement[test.operator="!"][test.argument.property.name="ok"] ReturnStatement > ObjectExpression[properties.length=0]',
  // queryClient.getQueryData(KEY) ?? [] 推出整份清單（收藏事故前端寫法）
  'LogicalExpression[operator="??"][left.callee.property.name="getQueryData"] > ArrayExpression[elements.length=0]',
];

const MICRO_FONT_MSG =
  '禁止小於 10px 的微型字體（CLAUDE.md UI 規範，行動端不可讀）。主要資訊用 text-xs 以上；次要徽章最小 text-[10px]。';
const MICRO_FONT = '/text-\\[\\d(\\.\\d+)?px\\]/';

const microFontSelectors = [
  `Literal[value=${MICRO_FONT}]`,
  `TemplateElement[value.raw=${MICRO_FONT}]`,
];

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'drizzle/**', 'local.db', '*.config.*', '**/*.backup.*'],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...emptyFallbackSelectors.map((selector) => ({ selector, message: EMPTY_FALLBACK_MSG })),
        ...microFontSelectors.map((selector) => ({ selector, message: MICRO_FONT_MSG })),
      ],
    },
  },
];
