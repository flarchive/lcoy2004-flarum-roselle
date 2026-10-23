import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import mithrilKeyRule from './eslint-local-rules/mithril-key.js';
import noHardcodedTextRule from './eslint-local-rules/no-hardcoded-text.js';

/**
 * ESLint flat config (ESLint 9+).
 *
 * Catches two categories of Mithril runtime errors at build time:
 *
 * 1. react/jsx-key
 *    Missing `key` prop on elements returned from iterators (.map, .flatMap, etc.).
 *    Example caught: items.map(i => <ThreadCard discussion={i} />)  ← no key → crash
 *
 * 2. mithril-key/consistent-child-keys  (local rule in eslint-local-rules/)
 *    Direct JSX siblings where SOME have `key` and some don't.
 *    Mithril crashes when it tries to reconcile a keyed tree with an unkeyed one.
 *    Example caught:
 *      <div>
 *        <Nav />            ← no key → ERROR
 *        <Main key="m" />   ← has key
 *      </div>
 */
export default [
  {
    // Only lint our source files; skip compiled output and node_modules.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['node_modules/**', 'dist/**'],

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },

    plugins: {
      // eslint-plugin-react — provides jsx-key, jsx-no-duplicate-props, etc.
      react: reactPlugin,

      // Our local Mithril-specific rule, loaded as an inline plugin object.
      // No npm package needed — just the file in eslint-local-rules/.
      'mithril-key': {
        rules: {
          'consistent-child-keys': mithrilKeyRule,
        },
      },

      // i18n guard — fails the build on hardcoded user-facing strings so the
      // theme stays translatable (see eslint-local-rules/no-hardcoded-text.js).
      i18n: {
        rules: {
          'no-hardcoded-text': noHardcodedTextRule,
        },
      },
    },

    settings: {
      // Tell eslint-plugin-react that our JSX factory is Mithril's m(), not React.
      // Without this, jsx-key would only trigger inside React.createElement calls.
      react: {
        pragma: 'm',
        version: 'detect',
      },
    },

    rules: {
      // ── 在 Roselle 中关闭 react/jsx-key ──────────────────────────────────────
      // 在 Mithril 中，整个列表都没有 key 是合法的；真正会出问题的是混用
      // 有 key 和无 key 的兄弟节点（见下面的 mithril-key 规则）。给每个
      // .map() 都加 key 会改变目前正常的列表复用行为。
      'react/jsx-key': 'off',

      // ── No duplicate props ────────────────────────────────────────────────────
      'react/jsx-no-duplicate-props': 'error',

      // ── Mithril-specific: consistent sibling keys ─────────────────────────────
      // Catches mixed keyed/unkeyed siblings that cause reconciliation crashes.
      'mithril-key/consistent-child-keys': 'error',

      // ── i18n: no hardcoded user-facing strings ────────────────────────────────
      'i18n/no-hardcoded-text': 'error',
    },
  },
];
