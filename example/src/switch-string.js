import { defineSuite } from "esbench";

export default defineSuite({
	name: "switch string literals",
	validate: {
		equality: true,
	},
	setup(scene) {
		const value = String(true);

		scene.bench("literal", () => {
			switch (value) {
				case "aaa":
				case "bar":
				case "ccccc":
				case "dd":
				case "evaluate":
				case "foo":
				case "get":
				case "switch string":
				case "true":
				case "literals":
				case "z":
					return true;
			}
		});

		scene.bench("char code", () => {
			switch (value.charCodeAt(0)) {
				case 97:
				case 98:
				case 99:
				case 100:
				case 101:
				case 102:
				case 115:
				case 116:
				case 108:
				case 122:
					return true;
			}
		});
	},
});
