module.exports = {
	root: true,
	extends: ["@kaciras/core", "@kaciras/typescript"],
	env: {
		node: true,
		browser: true,
	},
	overrides: [{
		files: "**/__tests__/*.spec.[jt]s",
		extends: ["@kaciras/jest"],
	}, {
		files: ["*.svelte"],
		extends: ["@kaciras/typescript/base"],
		plugins: ["svelte3"],
		processor: "svelte3/svelte3",
		parserOptions: {
			extraFileExtensions: [".svelte"],
		},
		settings: {
			"svelte3/typescript": () => require("typescript"),
		},
	}],
};
