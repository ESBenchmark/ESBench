import { build, Plugin } from "vite";

/**
 * Build esbench to a separated chunk that can be imported from workers and iframes.
 *
 * This is needed because ?url does not treat the file as a module.
 * Related issue: https://github.com/vitejs/vite/issues/6757
 */
export default <Plugin>{
	name: "esbench:runtime-bundle",
	enforce: "pre",

	apply(_, env) {
		return env.command === "build" && !env.isSsrBuild;
	},

	resolveId(id) {
		if (id === "esbench?url") return id;
	},

	async load(id) {
		if (id !== "esbench?url") {
			return;
		}
		const bundle = await build({
			logLevel: "warn",
			build: {
				write: false,
				rollupOptions: {
					preserveEntrySignatures: "exports-only",
					input: "../core/src/index.ts",
				},
			},
		});
		const [chunk] = (bundle as any).output;
		const ref = this.emitFile({
			type: "asset",
			name: "esbench.js",
			source: chunk.code,
		});
		return `export default import.meta.ROLLUP_FILE_URL_${ref}`;
	},
};
