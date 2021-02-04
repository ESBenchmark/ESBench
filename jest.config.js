module.exports = {
	testMatch: [
		"**/__tests__/*.spec.[jt]s",
	],
	moduleFileExtensions: [
		"ts", "js", "mjs", "node", "json",
	],
	preset: "ts-jest",
	testEnvironment: "node",
	clearMocks: true,
	coverageDirectory: "coverage",
	coverageProvider: "v8",
};
