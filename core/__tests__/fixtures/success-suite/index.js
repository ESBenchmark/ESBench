export default async function (post, _, __) {
	await post({ level: "info", log: "log message" });
	await post({ paramDef: [], meta: {}, notes: [], scenes: [] });
}
