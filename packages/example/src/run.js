import { defineBenchmark } from "@esbench/core/src/builder.js";

export default defineBenchmark({
	iterations: "1s",
}, (suite, params) => {
	const map = new Map();
	const obj = {};

	for (let i = 0; i < 10_000; i++) {
		obj[Math.random().toString(36)] = 1;
		map.set(Math.random().toString(36), 1);
	}

	suite.add("object", () => obj[Math.random().toString(36)]);
	suite.add("map", () => map.get(Math.random().toString(36)));
});
