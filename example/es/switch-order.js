import { defineSuite } from "esbench";

const value = ["act", "ion"].join("");
const number = parseInt("99");

function numberFirst() {
	switch (number) {
		case 99:
		case 999:
		case 888:
		case 777:
		case 666:
		case 555:
		case 444:
		case 333:
		case 222:
		case 111:
			return 33;
		case 0:
		case 1:
		case 2:
		case 3:
		case 4:
		case 5:
		case 6:
		case 7:
		case 8:
		case 9:
		case 11:
		case 22:
		case 33:
		case 44:
		case 55:
		case 66:
		case 77:
		case 88:
			return 11;
		case 101:
		case 202:
		case 303:
		case 404:
		case 505:
		case 606:
		case 707:
		case 808:
			return 22;
	}
}

function numberLast() {
	switch (number) {
		case 0:
		case 1:
		case 2:
		case 3:
		case 4:
		case 5:
		case 6:
		case 7:
		case 8:
		case 9:
		case 11:
		case 22:
		case 33:
		case 44:
		case 55:
		case 66:
		case 77:
		case 88:
			return 11;
		case 101:
		case 202:
		case 303:
		case 404:
		case 505:
		case 606:
		case 707:
		case 808:
			return 22;
		case 999:
		case 888:
		case 777:
		case 666:
		case 555:
		case 444:
		case 333:
		case 222:
		case 111:
		case 99:
			return 33;
	}
}

function stringFirst() {
	switch (value) {
		case "afford":
		case "action":
		case "actor":
		case "actress":
		case "actual":
		case "adapt":
		case "add":
		case "addict":
		case "address":
		case "adjust":
		case "admit":
		case "adult":
		case "advance":
		case "advice":
		case "aerobic":
		case "affair":
			return 33;
		case "abandon":
		case "ability":
		case "able":
		case "about":
		case "above":
		case "absent":
		case "absorb":
		case "abstract":
		case "absurd":
		case "abuse":
		case "access":
		case "accident":
		case "account":
		case "accuse":
		case "achieve":
		case "acid":
		case "acoustic":
		case "acquire":
		case "across":
		case "act":
			return 11;
		case "afraid":
		case "again":
		case "age":
		case "agent":
		case "agree":
		case "ahead":
		case "aim":
		case "air":
		case "airport":
		case "aisle":
		case "alarm":
		case "album":
		case "alcohol":
		case "alert":
		case "alien":
		case "all":
		case "alley":
		case "allow":
		case "almost":
		case "alone":
		case "alpha":
		case "already":
		case "also":
		case "alter":
		case "always":
		case "amateur":
		case "amazing":
		case "among":
		case "amount":
		case "amused":
		case "analyst":
			return 22;
	}
}

function stringLast() {
	switch (value) {
		case "abandon":
		case "ability":
		case "able":
		case "about":
		case "above":
		case "absent":
		case "absorb":
		case "abstract":
		case "absurd":
		case "abuse":
		case "access":
		case "accident":
		case "account":
		case "accuse":
		case "achieve":
		case "acid":
		case "acoustic":
		case "acquire":
		case "across":
		case "act":
			return 11;
		case "afraid":
		case "again":
		case "age":
		case "agent":
		case "agree":
		case "ahead":
		case "aim":
		case "air":
		case "airport":
		case "aisle":
		case "alarm":
		case "album":
		case "alcohol":
		case "alert":
		case "alien":
		case "all":
		case "alley":
		case "allow":
		case "almost":
		case "alone":
		case "alpha":
		case "already":
		case "also":
		case "alter":
		case "always":
		case "amateur":
		case "amazing":
		case "among":
		case "amount":
		case "amused":
		case "analyst":
			return 22;
		case "action":
		case "actor":
		case "actress":
		case "actual":
		case "adapt":
		case "add":
		case "addict":
		case "address":
		case "adjust":
		case "admit":
		case "adult":
		case "advance":
		case "advice":
		case "aerobic":
		case "affair":
		case "afford":
			return 33;
	}
}

export default defineSuite({
	params: {
		type: ["number", "string"],
	},
	setup(scene) {
		if (scene.params.type === "number") {
			scene.bench("first", numberFirst);
			scene.bench("last", numberLast);
		} else {
			scene.bench("first", stringFirst);
			scene.bench("last", stringLast);
		}
	},
});
