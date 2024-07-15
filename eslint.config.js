import core from "@kaciras/eslint-config-core";
import typescript from "@kaciras/eslint-config-typescript";
import vueTs from "@kaciras/eslint-config-vue/typescript.js";

export default [...core, ...typescript, ...vueTs,
	{
		ignores: [
			"docs/.vitepress/{cache,dist}/**",
			"core/{lib,coverage}/**",
		],
	},
	{
		rules: {
			"kaciras/import-group-sort": "warn",
			"kaciras/import-node-prefix": "error",
		},
	},
];
