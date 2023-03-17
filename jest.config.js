export default {
	testMatch: [
		"**/__tests__/*.spec.[jt]s",
	],
	moduleFileExtensions: [
		"ts", "js", "mjs", "node", "json",
	],
	preset: "ts-jest",
	clearMocks: true,
	coverageProvider: "v8",
	coverageDirectory: "coverage",
};
