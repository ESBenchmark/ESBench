import { defineSuite } from "esbench";

const a = undefined;
const b = undefined;
const c = null;
const d = null;
const e = 11;
const f = 22;

export default defineSuite({
	name: "?? vs ||",
	setup(scene) {
		scene.bench("??", () => a ?? b ?? c ?? d ?? e ?? f);
		scene.bench("||", () => a || b || c || d || e || f);
	},
});
