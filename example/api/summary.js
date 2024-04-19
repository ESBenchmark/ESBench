import { Summary } from "esbench";

// eslint-disable-next-line
const result = { "name": "Map vs Object - Get", "notes": [], "meta": {		"throughput": {		"key": "throughput", "format": "{number} ops/s", "lowerIsBetter": false, "analysis": 2, }, }, "paramDef": [["size", ["0", "1000", "1000000"]], ["exists", ["true", "false"]]], "scenes": [{		"object": { "throughput": [217241341, 221394029, 222655260, 233842057, 234855542, 235708640, 235783162, 236068142, 236650299, 236796608] }, "map": { "throughput": [264780277, 267402676, 268085271, 268530891, 268592781, 269240683, 269611771, 269844357, 270074933, 270191698] }, }, {		"object": { "throughput": [174014720, 174188463, 174901390, 175578998, 175589237, 175790273, 175837274, 175924793, 176167954, 176870798] }, "map": { "throughput": [262440239, 263816476, 266639775, 267814144, 268407669, 269521979, 271138579, 271814662, 301844823, 320067142] }, }, {		"object": { "throughput": [233806846, 234662712, 235676671, 236575370, 237009256, 237122815, 238057732, 238176815, 239087525, 245435751] }, "map": { "throughput": [233687621, 233810822, 237497531, 237895974, 238149275, 238516746, 238652311, 238723050, 238992333, 239492368] }, }, {		"object": { "throughput": [171723223, 175511549, 175709206, 175830684, 176194118, 176275532, 176422737, 176624044, 176678728, 176897947] }, "map": { "throughput": [195175137, 202291169, 204731529, 206004893, 206872008, 206914998, 208747517, 209507128, 210083994, 211024290] }, }, {		"object": { "throughput": [115922558, 116297385, 117556162, 117842963, 118020996, 118228461, 121105692, 121193574, 121263073, 121678142] }, "map": { "throughput": [233156080, 235329248, 235591051, 236388283, 237445969, 237461109, 237560229, 237906774, 238621477, 270244516] }, }, {		"object": { "throughput": [473068660, 475252994, 475812452, 475929285, 477152467, 477165049, 477588214, 479222685, 479590735, 480064107] }, "map": { "throughput": [232481353, 234212180, 234990674, 236351432, 237251130, 237277152, 237596980, 237947671, 251317516, 256486615] }, }], "builder": "None", "executor": "node", };

const summary = new Summary([result]);

console.log("Variables:", summary.vars);
console.log("Metric Descriptions:", summary.meta);

console.log("Case Results:");
for (let i = 0; i < summary.results.length; i++) {
	const result = summary.results[i];
	const metrics = Summary.getMetrics(result);

	console.log(`${i}.`.padEnd(3), JSON.stringify(result));
	console.log("   ", JSON.stringify(metrics));
}

// Get the metrics of specific case.
Summary.getMetrics(summary.find({
	Name: "object",
	exists: "true",
	size: "1000",
	Builder: "None",
	Executor: "node",
}));
