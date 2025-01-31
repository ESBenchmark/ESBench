import core from "@kaciras/eslint-config-core";
import typescript from "@kaciras/eslint-config-typescript";
import vueTs from "@kaciras/eslint-config-vue/typescript";

export default [...core, ...typescript, ...vueTs,
	{
		ignores: [
			"docs/.vitepress/{cache,dist}/**",
			"example/node/*/*.js",
			"core/{lib,coverage}/**",
		],
	},
	{
		rules: {
			"kaciras/import-specifier-order": "warn",
			"kaciras/import-node-prefix": "error",
		},
	},
];
