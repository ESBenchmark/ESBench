import { build, Plugin } from "vite";

export default <Plugin>{
	name: "esbench:runtime-bundle",
	enforce: "pre",
	apply: "build",

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
		})
		return `export default import.meta.ROLLUP_FILE_URL_${ref}`;
	},
};
