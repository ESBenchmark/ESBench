module.exports = {
	root: true,
	extends: [
		"@kaciras/core",
		"@kaciras/typescript",
		"@kaciras/vue/typescript",
	],
	env: {
		browser: true,
		node: true,
	},
	rules: {
		"@kaciras/import-group-sort": "warn",
	},
};
