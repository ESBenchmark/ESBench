import { argv, env, execArgv } from "process";

export default function (post) {
	return post([{ argv, execArgv, env }]);
}
