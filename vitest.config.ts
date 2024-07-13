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
		pool: "threads",
		coverage: {
			reporter: ["lcovonly"],
			provider: "v8",
		},
		restoreMocks: true,
		include: ["**/__tests__/**/*.spec.ts"],
	},
});
