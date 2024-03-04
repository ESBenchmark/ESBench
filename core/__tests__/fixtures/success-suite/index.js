export default async function (post, files, pattern) {
	await post({ level: "info", log: "log message" });
	await post([{ name: "Test", paramDef: [], meta: {}, notes: [], scenes: [] }]);
}
