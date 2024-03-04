import { defineConfig } from "vitest/config";

export default defineConfig({
	esbuild: {
		target: "esnext",
	},
	publicDir: false,
	test: {
		coverage: {
			reporter: ["lcov"],
			provider: "v8",
		},
		mockReset: true,
		include: ["**/__tests__/**/*.spec.ts"],
	},
});
