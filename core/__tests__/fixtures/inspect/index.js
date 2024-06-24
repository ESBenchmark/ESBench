import { argv, env, execArgv } from "process";

export default function (post) {
	return post({ scenes: [], argv, execArgv, env });
}
