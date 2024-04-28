import { defineSuite } from "esbench";

const numberCompare = (a, b) => a - b;

function quickSort(array, start, end) {
	if (end - start < 2) {
		return;
	}
	let pivot = array[start];
	let i = start + 1;
	let j = end - 1;

	while (i <= j) {
		if (array[i] <= pivot) {
			i += 1;
		} else if (array[j] >= pivot) {
			j -= 1;
		} else {
			[array[i], array[j]] = [array[j], array[i]];
			i += 1;
			j -= 1;
		}
	}
	[array[j], array[start]] = [array[start], array[j]];
	quickSort(array, j + 1, end);
	quickSort(array, start, i - 1);

	return array; // Make the behavior same as Array.sort
}

function bubbleSort(array) {
	for (let i = 0; i < array.length; i++)
		for (let j = 0; j < array.length - i - 1; j++)
			if (array[j + 1] < array[j])
				[array[j + 1], array[j]] = [array[j], array[j + 1]];
	return array;
}

function insertion(array, n) {
	for (let i = 1; i < array.length; i++) {
		let c = array[i];
		for (let j = i - n; j >= 0; j -= n) {
			if (c >= array[j]) {
				break;
			}
			[array[j + n], array[j]] = [array[j], c];
		}
	}
	return array;
}

function shellSort(array) {
	let n = 1;
	while (n < array.length) {
		n = n * 3 + 1;
	}
	while (n > 0) {
		n = Math.floor(n / 3);
		insertion(array, n);
	}
	return array;
}

export default defineSuite({
	name: "Array sort algorithms",
	baseline: {
		type: "Name",
		value: "builtin",
	},
	params: {
		length: [100, 100_000],

		// Default is "random"
		// order: ["random", "asc", "desc"],
	},
	validate: {
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
		const { length, order } = scene.params;
		const template = Array.from({ length }, () => Math.random());

		switch (order) {
			case "asc":
				template.sort(numberCompare);
				break;
			case "desc":
				template.sort(numberCompare);
				template.reverse();
		}

		let array = [];
		scene.beforeIteration(() => array = template.slice());

		if (array.toSorted) {
			scene.bench("toSorted", () => array.toSorted(numberCompare));
		}

		scene.bench("builtin", () => array.sort(numberCompare));
		scene.bench("shell", () => shellSort(array));
		scene.bench("quick", () => quickSort(array, 0, array.length));

		// Too slowly so only run them with small dataset.
		if (length <= 1000) {
			scene.bench("bubble", () => bubbleSort(array));
			scene.bench("insertion", () => insertion(array, 1));
		}
	},
});
