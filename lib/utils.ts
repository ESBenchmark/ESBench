import { ConfigData, ParamsConfig } from "./core.js";

export function createParamsIter(config: ParamsConfig) {
	type ParamList = Array<[string, any[]]>;

	function* cartesian(ctx: ConfigData, array: ParamList): Iterable<ConfigData> {
		const [head, ...tail] = array;
		const remainder = tail.length > 0 ? cartesian(ctx, tail) : [{}];
		const [key, values] = head;

		if (values.length === 0) {
			throw new Error("Parameter list cannot be empty");
		} else {
			for (const r of remainder)
				for (const v of values)
					yield { ...r, [key]: v };
		}
	}

	const kvs = Object.entries(config);
	return kvs.length === 0 ? [{}] : cartesian({}, kvs);
}
