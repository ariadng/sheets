import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
	{
		files: ['**/*.ts'],
		ignores: ['dist/**', 'node_modules/**'],
		languageOptions: {
			parser: tsParser,
			ecmaVersion: 2020,
			sourceType: 'module',
			parserOptions: {
				project: './tsconfig.json',
			},
		},
		plugins: {
			'@typescript-eslint': typescript,
		},
		rules: {
			...js.configs.recommended.rules,
			...typescript.configs.recommended.rules,
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'no-console': 'warn',
			indent: ['error', 'tab'],
			'linebreak-style': ['error', 'unix'],
			quotes: ['error', 'single'],
			semi: ['error', 'always'],
		},
	},
];