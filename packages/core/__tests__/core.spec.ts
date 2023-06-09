import { describe, it } from "vitest";
import { serializable } from "../src/client/message.ts";

describe("serializable", () => {
	it("should works", () => {
		const params = {
			a: ["loooooooooooooooooooooooooooooooooooooooooooooooooooong"],
			b: [{}, Object.create(null), []],
			c: [123, undefined, null, true],
			s: [Symbol(), Symbol("foo"), Symbol.for("bar")],
		};

		const s = serializable(params);
		console.log(s);
	});
});
