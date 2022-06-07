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
	}],
};
