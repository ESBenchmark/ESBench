export default async function (post, files, pattern) {
	await post({ level: "info", log: "log message" });
	await post([{ paramDef: [], meta: {}, notes: [], scenes: [] }]);
}
