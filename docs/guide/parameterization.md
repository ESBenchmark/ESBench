# Parameterization

Understanding how code performs under different inputs is a common requirement. ESBench has built-in support for this.

You can provide 

```javascript
export default defineSuite({
	name: "Map vs Object - Get",
	params: {
		size: [0, 1000, 1000_000],
		exists: [true, false],
	},
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

```text
| No. |   Name |    size | exists |      time |  stdDev |
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

# Builtin Parameters



# Avoiding Conflicts

For better representation, ESBench stores your parameter as a short string in the result and checks for duplicates. If two values in a parameter have same 



```javascript
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
    }
});
```