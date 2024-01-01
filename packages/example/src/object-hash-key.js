import { defineSuite } from "@esbench/core/client";

const small = {
	Name: "Benchmark",
};

const big = {
	cqLevel: 33,
	cqAlphaLevel: -1,
	denoiseLevel: 0,
	tileColsLog2: 0,
	tileRowsLog2: 0,
	speed: 6,
	sharpness: 0,
	tune: "auto",
	subsample: "YUV420",
	chromaDeltaQ: false,
	quality: 75,
	baseline: false,
	arithmetic: false,
	progressive: true,
	optimize_coding: true,
	smoothing: 0,
	color_space: "YCbCr",
	quant_table: "ImageMagick",
	trellis_multipass: false,
	trellis_opt_zero: false,
	trellis_opt_table: false,
	trellis_loops: 1,
	auto_subsample: true,
	chroma_subsample: 2,
	separate_chroma_quality: false,
	chroma_quality: 75,
};

function shallowHashKey(obj, keys) {
	return keys.map(k => `${k}=${obj[k]}`).join(",");
}

export default defineSuite({
	name: "Generate hashKey for object using shallow properties",
	params: {
		data: ["small", "big"],
	},
	setup(scene) {
		const object = scene.params.data === "small" ? small : big;
		const keys = Object.keys(object);
		scene.bench("Part Join", () => shallowHashKey(object, keys));
		scene.bench("JSON", () => JSON.stringify(object));
		scene.bench("JSON with keys", () => JSON.stringify(object, keys));
	},
});
