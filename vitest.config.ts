import { defineConfig } from "vitest/config";

export default defineConfig({
	esbuild: {
		target: "esnext",
	},
	publicDir: false,
	test: {
		mockReset: true,
		include: ["**/__tests__/**/*.spec.[tj]s"],
	},
});
