module.exports = {
	root: true,
	env: {
		node: true,
	},
	extends: [
		"@kaciras/typescript",
		"@kaciras/core",
	],
	overrides: [
		{
			files: require("./jest.config").testMatch,
			extends: [
				"plugin:jest/style",
				"plugin:jest/recommended",
			],
		},
	],
};
