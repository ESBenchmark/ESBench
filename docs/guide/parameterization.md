# Parameterization

Understanding how code performs under different inputs is a common requirement. ESBench has built-in support for that.

## Define Params

Through the `params` property, you can specify parameters with their set of values. As a result, you will get results for each combination of params values. 

The parameters of the combination can be retrieved via `scene.params`.

```javascript
export default defineSuite({
	params: {// [!code ++]
		size: [0, 1000, 1000_000],// [!code ++]
		exists: [true, false],// [!code ++]
	},// [!code ++]
    /*
     * Will be called 6 times with `scene.params` be each of the:
     * { size: 0, exists: true }
     * { size: 0, exists: false }
     * { size: 1000, exists: true }
     * { size: 1000, exists: false }
     * { size: 1000_000, exists: true }
     * { size: 1000_000, exists: false }
     */
	setup(scene) {
		const { size, exists } = scene.params;

		const obj = Object.create(null);
		const map = new Map();
		for (let i = 0; i < size; i++) {
			const data = i.toString();
			obj[data] = data;
			map.set(data, data);
		}
		const key = exists ? `${size / 2}` : "123.45";

		scene.bench("object", () => obj[key]);
		scene.bench("map", () => map.get(key));
	},
});
```

Output:

```text
| No. |   Name |    size | exists |      time | time.SD |
| --: | -----: | ------: | -----: | --------: | ------: |
|   0 | object |       0 |   true |  78.42 ns | 0.28 ns |
|   1 |    map |       0 |   true |  62.14 ns | 2.39 ns |
|   2 | object |       0 |  false | 103.03 ns | 5.88 ns |
|   3 |    map |       0 |  false |  66.31 ns | 3.06 ns |
|   4 | object |    1000 |   true |  73.95 ns | 3.77 ns |
|   5 |    map |    1000 |   true |  57.60 ns | 4.27 ns |
|   6 | object |    1000 |  false | 104.77 ns | 4.20 ns |
|   7 |    map |    1000 |  false |  82.13 ns | 1.43 ns |
|   8 | object | 1000000 |   true |  10.18 ns | 0.32 ns |
|   9 |    map | 1000000 |   true | 112.13 ns | 2.72 ns |
|  10 | object | 1000000 |  false |  36.33 ns | 0.15 ns |
|  11 |    map | 1000000 |  false | 184.70 ns | 4.93 ns |
```

## Variables

ESBench identifies each benchmark case using a set of properties called variables, which contain:

* `Name`: the names of benchmark cases.
* `Builder` & `Executor`: the names of tools used to build and execute the suite, see [Toolchains](./toolchains) for more details.
* Properties defined in suite's `params` option.

In the above example, the variables with their possible values is:

```json
{
	"Name": ["object", "map"],
    "Builder": ["None"],
    "Executor": ["node"],
    "size": [0, 1000, 1000000],
    "exists": [true, false]
}
```

By default, variables have only 1 value are not shown in text report.

Builtin variable names are Pascal case, and suite cannot redefine parameter with the same name.

```javascript
export default defineSuite({
	params: {
		// Error: "Builder" is a builtin variable.
		Builder: [0, 1000, 1000_000],
	},
});
```

If you [run a suite with multiple runtimes](./toolchains), the names of all variables must be consistent.

```javascript
const params = { foo: [1, 1000] };

// Don't do this.
if (typeof window === "undefined") {
	params.bar = ["a", "b"];
}

export default defineSuite({
	params,
	setup(scene) { /*...*/ },
});
```

## Avoiding Conflicts

For better reading, ESBench stores your parameter as a short string in the result and checks for duplicates. ESBench does not allow two values in a parameter to have same short representation.

```javascript
// Run this suite will throw an error.
export default defineSuite({
	params: {
		// Both represent as "[object Object]"
		config: [
			{ output: { format: "es" }, minify: true },
			{ output: { format: "cjs" } },
        ],
		// Both represent as "looooooo…ooooong"
		text: [
			"looooooooooooo_A_oooooooooooong",
			"looooooooooooo_B_oooooooooooong",
		],
	},
    setup(scene) { /* ... */ },
});
```

To solve this problem, we recommend giving complex and long parameters readable names, then retrieving their values in the `setup` function.

```javascript
const config1 = { output: { format: "es" }, minify: true };
const config2 = { output: { format: "cjs" } };

export default defineSuite({
	params: {
		config: ["ES + Minify", "CJS"],
		text: ["Text A", "Text B"],
	},
    setup(scene) {
		const config = scene.params.config === "CJS" 
            ? config2 : config1;
		
		const text = scene.params.text === "Text A" 
            ? "looooooooooooo_A_oooooooooooong" 
            : "looooooooooooo_B_oooooooooooong";
    },
});
```
