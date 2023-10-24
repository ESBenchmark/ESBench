import { writeFileSync } from "fs";
import { join } from "path";
import { Builder } from "../stage.js";

const code = `\
import { connect } from "@esbench/core/client";

const doImport = file => import("../." + file);

export default function (channel, files, name) {
	return connect(channel, doImport, files, name);
}`;

export default <Builder>{
	name: "NoBuild",
	build({ root }) {
		writeFileSync(join(root, "index.js"), code);
		return "./index.js";
	},
};
