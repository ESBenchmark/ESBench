import { defineSuite } from "esbench";

const charCodes = Array.from({ length: 26 }, (_, i) => 97 + i);
const strings = charCodes.map(c => String.fromCharCode(c, c, c, c, c));

const switchString = new Function("value", `\
	switch(value) {
		${strings.map(s => "case '" + s + "':\n").join("")}
		return true;
	}
`);

const switchFirstCode = new Function("value", `\
	switch(value.charCodeAt(0)) {
		${charCodes.map(c => "case " + c + ":\n").join("")}
		return true;
	}
`);

function switchLiteral(value) {
	switch (value) {
		case "caseAlfa":
		case "bravo":
		case "charlie":
		case "delta":
		case "echo":
		case "foxtrot":
		case "golf":
		case "hotel":
		case "india":
		case "juliett":
		case "kilo":
		case "lima":
		case "mike":
		case "november":
		case "oscar":
		case "papa":
		case "quebec":
		case "romeo":
		case "sierra":
		case "tango":
		case "uniform":
		case "victor":
		case "whiskey":
		case "x-ray":
		case "yankee":
		case "zulu":
			return true;
	}
}

export default defineSuite({
	validate: {
		equality: true,
	},
	setup(scene) {
		scene.bench("literal", () => switchLiteral("kilo"));
		scene.bench("char code", () => switchFirstCode("kkkkk"));
		scene.bench("string", () => switchString("kkkkk"));
	},
});
