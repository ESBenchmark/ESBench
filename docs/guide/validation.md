# Validation

ESBench can validate your benchmarks before they are executed and produce validation errors. If any of the validation errors is critical, then none of the benchmarks will get executed.

If `validate` property exists in the suite, all scenes and their cases will be run once to ensure no exceptions.

```javascript
export default defineSuite({
	validate: {}, // Ensure workloads don't throw errors.
    setup(scene) {/* ... */},
});
```

There are also `check` and `equality` options to perform additional checks. The `check` function accepts the return value of each case and scene parameters, you can throw an error if the value is incorrect.

```javascript
export default defineSuite({
	params: {
		length: [100, 100_000],
	},
	validate: { // [!code ++]
		/** // [!code ++]
         * Validate the retured array is sorted. // [!code ++]
         *  // [!code ++]
		 * @param v The return value of case. // [!code ++]
		 * @param p is `scene.params` // [!code ++]
		 */ // [!code ++]
		check(v, p) { // [!code ++]
			if (v.length !== p.length) // [!code ++]
				throw new Error("Array length changed"); // [!code ++]
			for (let i = 1; i < v.length; i++) { // [!code ++]
				if (v[i - 1] > v[i]) // [!code ++]
					throw new Error("Not sorted"); // [!code ++]
			} // [!code ++]
		}, // [!code ++]
	}, // [!code ++]
	setup(scene) {
		const { length } = scene.params;
		const template = Array.from({ length }, Math.random);
		let array = [];

		scene.beforeIteration(() => array = template.slice());

		scene.bench("builtin", () => array.sort(numberCompare));
	},
});
```

The `equality` function can be used to ensure the return values of all cases are equal within the same scene.

```javascript
export default defineSuite({
	validate: {// [!code ++]
		// Validate the returned value are equal (===).// [!code ++]
		equality: true,// [!code ++]
	},// [!code ++]
	setup(scene) {
		const values = Array.from({ length: 100 }, (_, i) => i);

		scene.bench("For-of", () => {
			let s = 0; 
			for (const v of values) s += v; 
			return s;
		});

		scene.bench("Array.reduce", () => {
			return values.reduce((v, s) => s + v, 0);
		});
	},
});
```

```javascript
export default defineSuite({
	validate: {// [!code ++]
		// Validate the returned buffers are equal.// [!code ++]
		equality(a, b) {// [!code ++]
			const v1 = new Uint8Array(a);// [!code ++]
			const v2 = new Uint8Array(b);// [!code ++]
			return v1.every((b, i) => b === v2[i]);// [!code ++]
		},// [!code ++]
	},// [!code ++]
	setup(scene) {
		const base64 = "nMrzJq4gg8PTkWQN";

		scene.bench("btoa", () => {
			const s = atob(base64);
			const view = new Uint8Array(s.length);
			for (let i = 0; i < s.length; i++) {
				view[i] = s.charCodeAt(i);
			}
			return view.buffer;
		});

		scene.benchAsync("fetch", () =>
			fetch("data:x/x;base64," + base64).then(r => r.arrayBuffer()));
	},
});
```
