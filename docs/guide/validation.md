# Validation

ESBench can validate your benchmarks before they are executed and produce validation errors. If any of the validation errors is critical, then none of the benchmarks will get executed.

If `validate` property exists in the suite, all scenes and their cases will be run once to ensure no exceptions.

```javascript
export default defineSuite({
	validate: {}, // Ensure workloads don't throw errors.
    setup(scene) {/* ... */},
});
```

There are also `check` and `equality` options to perform additional checks.

```javascript
export default defineSuite({
	params: {
		length: [100, 100_000],
	},
	validate: {// [!code ++]
		// Validate the retured array is sorted.// [!code ++]
		check(v, p) {// [!code ++]
			if (v.length !== p.length)// [!code ++]
				throw new Error("Array length changed");// [!code ++]
			for (let i = 1; i < v.length; i++) {// [!code ++]
				if (v[i - 1] > v[i])// [!code ++]
					throw new Error("Not sorted");// [!code ++]
			}// [!code ++]
		},// [!code ++]
	},// [!code ++]
	setup(scene) {
		const { length } = scene.params;
		const template = Array.from({ length }, () => Math.random());
		let array = [];

		scene.beforeIteration(() => array = template.slice());

		scene.bench("builtin", () => array.sort(numberCompare));
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
