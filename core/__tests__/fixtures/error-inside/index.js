export default async function (post, files, pattern) {
	const { stack } = new Error();
	await post({ e: { name: "Error", message: "Stub Error", stack } });
}
