# Validation

ESBench can validate your benchmarks before they are executed and produce validation errors. If any of the validation errors is critical, then none of the benchmarks will get executed.



```javascript
export default defineSuite({
	name: "Array sort algorithms",
	params: {
		length: [100, 100_000],
	},
	validate: {
		// Validate the retured array is sorted.
		check(v, p) {
			if (v.length !== p.length)
				throw new Error("Array length changed");
			for (let i = 1; i < v.length; i++) {
				if (v[i - 1] > v[i])
					throw new Error("Not sorted");
			}
		},
	},
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
	name: "Decode base64 string into ArrayBuffer",
	validate: {
		// Validate the returned buffers are equal.
		equality(a, b) {
			const v1 = new Uint8Array(a);
			const v2 = new Uint8Array(b);
			return v1.every((b, i) => b === v2[i]);
		},
	},
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
