import { defineSuite } from "esbench";

/**
 * Measure the performance advantage of `URL.canParse` over `new URL` + try-catch.
 *
 * Also a port of Node's benchmark:
 * https://github.com/nodejs/node/blob/66b76e24e2a277b32d65094684ab7410812e45ae/benchmark/url/whatwg-url-canParse.js
 *
 * The params is from:
 * https://github.com/nodejs/node/blob/66b76e24e2a277b32d65094684ab7410812e45ae/benchmark/common.js#L328
 */
export default defineSuite({
	params: {
		type: {
			long: "http://nodejs.org:89/docs/latest/api/foo/bar/qua/13949281/0f28b/" +
				"/5d49/b3020/url.html#test?payload1=true&payload2=false&test=1" +
				"&benchmark=3&foo=38.38.011.293&bar=1234834910480&test=19299&3992&" +
				"key=f5c65e1e98fe07e648249ad41e1cfdb0",
			short: "https://nodejs.org/en/blog/",
			idn: "http://你好你好.在线",
			auth: "https://user:pass@example.com/path?search=1",
			file: "file:///foo/bar/test/node.js",
			ws: "ws://localhost:9229/f46db715-70df-43ad-a359-7f9949f39868",
			javascript: 'javascript:alert("node is awesome");',
			percent: "https://%E4%BD%A0/foo",
			dot: "https://example.org/./a/../b/./c",
		},
	},
	timing: {
		iterations: 1e6,
	},
	baseline: {
		type: "Name",
		value: "try-catch",
	},
	setup(scene) {
		const { type } = scene.params;

		scene.bench("try-catch", () => {
			try {
				new URL(type);
				return true;
			} catch {
				return false;
			}
		});

		scene.bench("canParse", () => URL.canParse(type));
	},
});
