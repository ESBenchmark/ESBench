module.exports = {
	root: true,
	extends: [
		"@kaciras/core",
		"@kaciras/typescript",
		'plugin:svelte/recommended',
	],
	env: {
		browser: true,
		node: true,
	},
	parserOptions: {
		extraFileExtensions: ['.svelte']
	},
	rules: {
		"@kaciras/import-group-sort": "warn",
	},
	overrides: [{
		files: ["*.svelte"],
		parser: 'svelte-eslint-parser',
		parserOptions: {
			parser: '@typescript-eslint/parser'
		},
	}],
};
