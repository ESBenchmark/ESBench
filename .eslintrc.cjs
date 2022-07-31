module.exports = {
	root: true,
	extends: [
		"@kaciras/core",
		"@kaciras/typescript",
	],
	env: {
		node: true,
		browser: true,
	},
	overrides: [{
		files: "**/__tests__/*.spec.[jt]s",
		extends: ["@kaciras/jest"],
	},{
		settings: {
			'svelte3/typescript': () => require('typescript')
		},
		plugins: ['svelte3'],
		files: ['*.svelte'],
		processor: 'svelte3/svelte3'
	}],
};
