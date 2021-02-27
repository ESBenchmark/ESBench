module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	plugins: [
		'@typescript-eslint',
	],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
	],
	rules: {
		"quotes": ["error", "double", { avoidEscape: true }],
		"no-unused-vars": "off",
		"require-atomic-updates": "off",
		"semi": ["error", "always"],
		"comma-dangle": ["error", "always-multiline"],
	},
};
