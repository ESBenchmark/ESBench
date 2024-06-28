import { defineSuite } from "esbench";

const a = undefined;
const b = undefined;
const c = null;
const d = null;
const e = 11;
const f = 22;

export default defineSuite(scene => {
	scene.bench("??", () => a ?? a ?? b ?? b ?? c ?? d ?? e ?? f);
	scene.bench("||", () => a || a || b || b || c || d || e || f);
});
