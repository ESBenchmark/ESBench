import { defineSuite } from "esbench";

export default defineSuite({
	params: {
		length: [10, 50, 200, 520, 3000, 7500, 10_000],
	},
	complexity: {
		param: "length",
		metric: "time",
	},
	timing: {
		// There a bit too many cases, make it run faster.
		iterations: "100ms",
	},
	setup(scene) {
		const { length } = scene.params;

		const ordered = Array.from({ length }, (_, i) => i);
		const unordered = Array.from({ length }, Math.random);

		let forSort;
		scene.beforeIteration(() => forSort = unordered.slice());

		scene.bench("Median", () => {
			const i = Math.floor(ordered.length / 2);
			if (ordered.length & 1) {
				return ordered[i];
			} else {
				return (ordered[i] + ordered[i - 1]) / 2;
			}
		});
		scene.bench("Sum", () => unordered.reduce((s, v) => s + v));
		scene.bench("Binary Search", () => {
			return binarySearch(ordered, Math.random() * length);
		});
		scene.bench("Bubble Sort", () => bubbleSort(forSort));
		scene.bench("Array.sort", () => forSort.sort((a, b) => a - b));
	},
});

function binarySearch(arr, target) {
	let start = 0;
	let end = arr.length - 1;
	while (start <= end) {
		let middle = Math.floor((start + end) / 2);
		if (arr[middle] < target) {
			start = middle + 1;
		} else if (arr[middle] > target) {
			end = middle - 1;
		} else if (arr[middle] === target) {
			return middle;
		}
	}
	return -1;
}

function bubbleSort(array) {
	for (let i = 0; i < array.length; i++)
		for (let j = 0; j < array.length - i - 1; j++)
			if (array[j + 1] < array[j])
				[array[j + 1], array[j]] = [array[j], array[j + 1]];
	return array;
}
