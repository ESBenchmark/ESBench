import { defineSuite } from "esbench";

const small = {
	Name: "Benchmark",
	Builder: "None",
	Executor: "node",
};

const big = {
	cqLevel: "33",
	cqAlphaLevel: "-1",
	denoiseLevel: "0",
	tileColsLog2: "0",
	tileRowsLog2: "0",
	speed: "6",
	sharpness: "0",
	tune: "auto",
	subsample: "YUV420",
	chromaDeltaQ: "false",
	quality: "75",
	baseline: "false",
	arithmetic: "false",
	progressive: "true",
	optimize_coding: "true",
	smoothing: "0",
	color_space: "YCbCr",
	quant_table: "ImageMagick",
	trellis_multipass: "false",
	trellis_opt_zero: "false",
	trellis_opt_table: "false",
	trellis_loops: "1",
	auto_subsample: "true",
	chroma_subsample: "2",
	chroma_quality: "75",
};

function shallowHashKey(obj, keys) {
	return keys.map(k => `${k}${obj[k]}`).join();
}

function shallowHashKey2(obj, keys) {
	const { length } = keys;
	const array = new Array(length * 2);
	for (let i = 0; i < length; i += 2) {
		const k = keys[i].replaceAll(/\\,/g, v => "\\"+v);
		array[i] = k;
		array[i + 1] = obj[k];
	}
	return array.join();
}

export default defineSuite({
	name: "Generate hashKey for object using shallow properties",
	params: {
		data: ["small", "big"],
	},
	baseline: {
		type: "Name",
		value: "Part Join",
	},
	setup(scene) {
		const object = scene.params.data === "small" ? small : big;
		const keys = Object.keys(object);

		scene.bench("Part Join", () => shallowHashKey(object, keys));
		scene.bench("Part Join v2", () => shallowHashKey2(object, keys));
		scene.bench("JSON", () => JSON.stringify(object));
		scene.bench("JSON with keys", () => JSON.stringify(object, keys));
	},
});
