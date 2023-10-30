import { writeFileSync } from "fs";
import { Reporter } from "../config.js";

export default function (file?: string): Reporter {
	return result => writeFileSync(file ?? "benchmark.json", JSON.stringify(result));
}
