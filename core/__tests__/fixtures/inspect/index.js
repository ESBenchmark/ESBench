import { argv, env, execArgv } from "node:process";

export default function (post) {
	return post({ scenes: [], argv, execArgv, env });
}
