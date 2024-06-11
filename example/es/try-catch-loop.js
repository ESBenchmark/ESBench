import { defineSuite } from "esbench";

export default defineSuite(scene => {
	scene.bench("inside", () => {
		let sum = 0;
		for (let i = 0; i < 1000; i++) {
			try {
				sum += i;
			} catch (e) {
				return -1;
			}
		}
		return sum;
	});

	scene.bench("outside", () => {
		try {
			let sum = 0;
			for (let i = 0; i < 1000; i++) {
				sum += i;
			}
			return sum;
		} catch (e) {
			return -1;
		}
	});
});
