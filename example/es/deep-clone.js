import { defineSuite } from "esbench";

const data = { "name": "Suite","notes": [{ "type": "warn","text": "The function duration is indistinguishable from the empty function duration.","caseId": 0 }],"meta": { "throughput": { "key": "throughput","format": "{number} ops/s","lowerIsBetter": false,"analysis": 2 } },"paramDef": [["size",["0","1000","1000000"]],["exists",["true","false"]]],"scenes": [{ "object": {},"map": { "throughput": [269745946,269818546,270117638,270130430,270225639,270386122,270529153,270646338,270738283,271022126] } },{ "object": { "throughput": [175455109,176173556,176332348,176567159,176858491,177149507,177721506,185009077,194016955,198632878] },"map": { "throughput": [253118087,253127954,253152012,258006385,264792189,267331686,269109574,270479742,271168141,319699563] } },{ "object": { "throughput": [235257169,237203843,237535103,237790743,238021731,238515435,238773233,238803685,242554991,253455791] },"map": { "throughput": [139424151,139468572,139544267,139624363,139864545,139878892,139889215,139976159,140013692,140102654] } },{ "object": { "throughput": [174103094,174941597,175294114,175791353,175979339,175989669,176356434,176426771,176443871,176462441] },"map": { "throughput": [252371971,253073957,261192351,262078030,265930216,266511210,266716468,267279968,270015270,271120833] } },{ "object": { "throughput": [1144802354,1158885822,1177712468,1183695693,1186145377,1196442227,1197437603,1197443054,1198065329,1198892192] },"map": { "throughput": [253440933,258854615,267068667,268857257,269076498,269919576,270370943,270432702,270437099,270791709] } },{ "object": { "throughput": [459479388,459994272,461434142,463360919,463871921,466418289,466995915,468065854,469094428,470660442] },"map": { "throughput": [235001650,236951961,237241982,237279453,237885923,238066533,238308407,238512900,239307822,244607723] } }],"builder": "None","executor": "node" };

function clone(obj) {
	if (obj === null || typeof obj !== "object") {
		return obj;
	}
	if (Array.isArray(obj)) {
		const copied = [];
		for (let i = 0; i < obj.length; i++) {
			copied[i] = clone(obj[i]);
		}
		return copied;
	} else {
		const copied = {};
		for (const [k, v] of Object.entries(obj)) {
			copied[k] = clone(v);
		}
		return copied;
	}
}

export default defineSuite(async scene => {
	scene.bench("JSON", () => JSON.parse(JSON.stringify(data)));
	scene.bench("structuredClone", () => structuredClone(data));
	scene.bench("recursion", () => clone(data));

	try {
		const { serialize, deserialize } = await import("v8");
		scene.bench("v8 serialize", () => deserialize(serialize(data)));
	} catch {
		// Module v8 is not available, skip this benchmark case.
	}
});
