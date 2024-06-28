import { defineSuite } from "esbench";

// 25 properties
const literal = { cqLevel: 33, cqAlphaLevel: -1, denoiseLevel: 0, tileColsLog2: 0, tileRowsLog2: 0, speed: 6, sharpness: 0, tune: "auto", subsample: "YUV420", chromaDeltaQ: false, quality: 75, baseline: false, arithmetic: false, progressive: true, optimize_coding: true, smoothing: 0, color_space: "YCbCr", quant_table: "ImageMagick", trellis_multipass: false, trellis_opt_zero: false, trellis_opt_table: false, trellis_loops: 1, auto_subsample: true, chroma_subsample: 2, separate_chroma_quality: false, chroma_quality: 75 };
const non_literal = {};

for (let i = 0; i < 25; i++) {
	const v = Math.round(10_000_000 + i * 5_000_000);
	non_literal[v.toString(36)] = v;
}

export default defineSuite({
	baseline: { type: "Name", value: "entries" },
	params: {
		object: { literal, non_literal },
	},
	setup(scene) {
		const { object } = scene.params;

		scene.bench("for-in", () => {
			let returnValue;
			// eslint-disable-next-line no-restricted-syntax
			for (const k in object) {
				if (Object.hasOwn(object, k)) {
					returnValue = object[k];
				}
			}
			return returnValue;
		});

		scene.bench("keys", () => {
			let returnValue;
			for (const k of Object.keys(object)) {
				returnValue = object[k];
			}
			return returnValue;
		});

		scene.bench("entries", () => {
			let returnValue;
			for (const e of Object.entries(object)) {
				returnValue = e[1];
			}
			return returnValue;
		});
	},
});
