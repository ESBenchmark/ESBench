import { defineConfig } from "vitest/config";

export default defineConfig({
	esbuild: {
		target: "esnext",
	},
	publicDir: false,
	test: {
		// Some tests are depend on execution time,
		// so we disabled threads to improve accuracy.
		poolOptions: {
			threads: {
				singleThread: true,
			},
		},
		coverage: {
			reporter: ["lcov"],
			provider: "v8",
		},
		restoreMocks: true,
		include: ["**/__tests__/**/*.spec.ts"],
	},
});
