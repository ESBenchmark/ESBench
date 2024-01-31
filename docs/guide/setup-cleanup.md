

```javascript
export default defineSuite({
	name: "Array sort algorithms",
	setup(scene) {
		const template = [];
		let array = [];
		for (let i = 0; i < 1000; i++) {
			template.push(Math.random());
		}
		// Time of sort depends the elelemts order, so we must reset the array.
		scene.beforeIteration(() => array = template.slice());
		scene.bench("builtin", () => array.sort((a, b) => a - b));
	},
});
```
