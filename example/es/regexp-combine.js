import { defineSuite } from "esbench";

const patterns = [
	"foo", "bar", "baz", "esbench",
	/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/.source,
];

const res = patterns.map(p => new RegExp(p));
const merged = new RegExp("(?:" + patterns.join("|") + ")");

const text = "Search numbers from the text and insert thousands 1234.5678 separators to them.";

export default defineSuite({
	validate: {
		check: value => value === true,
	},
	setup(scene) {
		scene.bench("uncombined", () => {
			for (const p of res)
				if (p.test(text))
					return true;
			return false;
		});

		scene.bench("combined", () => merged.test(text));
	},
});
