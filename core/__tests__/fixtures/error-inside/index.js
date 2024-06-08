export default async function (post) {
	const inner = function bar() { return new Error("Inner"); }();
	const cause = { name: "Error", message: "Inner", stack: inner.stack };

	const { stack } = new Error();
	await post({ e: { name: "Error", message: "Stub Error", stack, cause } });
}
