const jestConfig = require("./jest.config");

module.exports = {
	root: true,
	extends: [
		"@kaciras/core",
		"@kaciras/typescript",
	],
	env: {
		node: true,
	},
	overrides: [
		{
			files: jestConfig.testMatch,
			extends: ["@kaciras/jest"],
		},
	],
};
