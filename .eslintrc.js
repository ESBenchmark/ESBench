module.exports = {
	root: true,
	env: {
		node: true,
	},
	extends: [
		"@kaciras/core",
		"@kaciras/typescript",
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
