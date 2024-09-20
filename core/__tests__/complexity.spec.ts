import { expect, it } from "vitest";
import { noop } from "@kaciras/utilities/node";
import { Metrics, Profiler } from "../src/profiling.ts";
import ComplexityProfiler from "../src/complexity.ts";
import { runProfilers } from "./helper.ts";
import { Scene } from "../src/index.ts";

const xValues = [10, 50, 200, 520, 3000, 7500, 10000];
const yValues = [
	{
		complexity: "O(1)",
		values: [66, 66, 66, 66, 66, 66, 66],
	},
	{
		complexity: "O(N)",
		values: [9, 57, 221, 498, 2997, 8964, 10086],
	},
	{
		complexity: "O(logN)",
		values: [
			[0.04117766226759628, 0.04120752199535189, 0.0412603108399734, 0.04126119895418325, 0.04126685964475428, 0.04128747717463479, 0.0413030399236387, 0.041305065156042514, 0.041313510541168656, 0.04132866658366527],
			[0.06805565137986996, 0.06805846523268384, 0.0680845813041124, 0.06810775500541134, 0.06810912134740237, 0.06811097470238091, 0.06811795522186102, 0.06811848958333316, 0.06814837324134161, 0.06816692708333302],
			[0.09055687409551355, 0.09055956041968201, 0.09058825976845146, 0.09062981186685955, 0.090633854920405, 0.09065067836468879, 0.09065644898697499, 0.0906588277858177, 0.09068671309696069, 0.09070804992764084],
			[0.11846590136054311, 0.11848002763605375, 0.11850749362244896, 0.11853308886054414, 0.11854651360544172, 0.11854946853741487, 0.11856128826530518, 0.11880216836734658, 0.11881648596938688, 0.11908618197278785],
			[0.15213708378820928, 0.15219471206331922, 0.15227888236899456, 0.15228084743449674, 0.15230127592794776, 0.15231045987991218, 0.15231539983624437, 0.15231832014192093, 0.15232291894104558, 0.15234830103711564],
			[0.15949570411392394, 0.15950473892405137, 0.15952103639240395, 0.15954592563291126, 0.1595600553797478, 0.15958416930379712, 0.15959195411392277, 0.15959546677215167, 0.1596232990506307, 0.15963470727847956],
			[0.17779018554687553, 0.17785520833333380, 0.17795621744791862, 0.17800900065104247, 0.17806609700520917, 0.17807825520833612, 0.17813544921875035, 0.17900862630208297, 0.17969591471354343, 0.17995411783854345],
		],
	},
	{
		complexity: "O(NlogN)",
		values: [
			0.0005969855843158,
			0.0045202441938359,
			0.02424999511930705,
			0.07221788006758754,
			0.5500838882211068,
			1.5820801162789906,
			2.1435602428256657,
		],
	},
	{
		complexity: "O(N^2)",
		values: [
			0.0002953256049001,
			0.00590669962202318,
			0.06208956928343995,
			0.35493970454548207,
			10.945971978021912,
			68.72572928571432,
			126.28999250000015,
		],
	},
	{
		complexity: "O(N^3)",
		values: [
			0.23340450001646867,
			0.10618904850688948,
			0.01975597525934525,
			0.8933325993259217,
			52.74914415025435,
			824.5106068945372,
			1953.4639760089187,
		],
	},
];

type MockMeasureTime = (i: MockTimeProfiler) => Metrics[string];

class MockTimeProfiler implements Profiler {

	private readonly getTime: MockMeasureTime;

	scene!: Scene;
	sceneIndex = -1;
	caseIndex = -1;

	constructor(getTime: MockMeasureTime) {
		this.getTime = getTime;
	}

	onScene(_: unknown, scene: Scene) {
		this.scene = scene;
		this.sceneIndex += 1;
		this.caseIndex = -1;
	}

	onCase(_: unknown, __: unknown, metrics: Metrics) {
		this.caseIndex += 1;
		metrics.time = this.getTime(this);
	}
}

it("should throw error if the variable does not exists", () => {
	const promise = runProfilers([
		new ComplexityProfiler({ param: "xValues", metric: "time" }),
	]);
	return expect(promise).rejects.toThrow();
});

it("should check param values is all numbers", () => {
	const promise = runProfilers([
		new ComplexityProfiler({ param: "xValues", metric: "time" }),
	], {
		params: {
			xValues: [1, false],
		},
	});
	return expect(promise).rejects.toThrow("Param xValues must be finite numbers");
});

it("should reject non-numeric values", () => {
	const promise = runProfilers([
		new ComplexityProfiler({ param: "xValues", metric: "time" }),
		new MockTimeProfiler(() => "foobar"),
	], {
		params: { xValues },
	});
	return expect(promise).rejects
		.toThrow('Metric "time" has string type and cannot be used to calculate complexity');
});

it("should reject non-finite values", () => {
	const promise = runProfilers([
		new ComplexityProfiler({ param: "xValues", metric: "time" }),
		new MockTimeProfiler(() => Infinity),
	], {
		params: { xValues },
	});
	return expect(promise).rejects
		.toThrow("Only finite number can be used to calculate complexity");
});

it.each(yValues)("should get the complexity", async data => {
	const context = await runProfilers([
		new MockTimeProfiler(i => data.values[i.sceneIndex]),
		new ComplexityProfiler({ param: "xValues", metric: "time" }),
	], {
		params: { xValues },
	});
	expect(context.meta.complexity).toStrictEqual({ key: "complexity" });
	expect(context.scenes[0].Test.complexity).toBe(data.complexity);
});

it("should skip cases that does not have enough samples", async () => {
	const context = await runProfilers([
		new MockTimeProfiler(() => 11),
		new ComplexityProfiler({ param: "xValues", metric: "time" }),
	], {
		params: { xValues },
		setup: scene => {
			if (scene.params.xValues <= 10) {
				scene.bench("Test", noop);
			}
		},
	});
	expect(context.meta.complexity).toStrictEqual({ key: "complexity" });
	expect(context.scenes[0].Test.complexity).toBeUndefined();
});

it("should group metrics of each case", async () => {
	const context = await runProfilers([
		new MockTimeProfiler(i => {
			const { multipleN, xValues, dataSet } = i.scene.params;
			const factor = multipleN ? xValues : 1;
			const series = yValues[dataSet].values as number[];
			return factor * series[Math.floor(i.sceneIndex / 2 % 7)];
		}),
		new ComplexityProfiler({ param: "xValues", metric: "time" }),
	], {
		params: {
			dataSet: [0, 1],
			xValues,
			multipleN: [false, true],
		},
	});

	for (let i = 0; i < 14; i += 2) {
		expect(context.scenes[i].Test.complexity).toBe("O(1)");
		expect(context.scenes[i + 1].Test.complexity).toBe("O(N)");
	}
	for (let i = 14; i < 28; i += 2) {
		expect(context.scenes[i].Test.complexity).toBe("O(N)");
		expect(context.scenes[i + 1].Test.complexity).toBe("O(N^2)");
	}
});

it("should support custom curves", async () => {
	const context = await runProfilers([
		new MockTimeProfiler(i => {
			const ixValues = Math.floor(i.sceneIndex / 2) % 7;
			return yValues[i.caseIndex & 1].values[ixValues];
		}),
		new ComplexityProfiler({
			param: "xValues",
			metric: "time",
			curves: {
				typeA: n => Math.log(Math.log(n)),
				typeB: n => n ** 1.5,
			},
		}),
	], {
		params: {
			multipleN: [false, true],
			xValues,
			dataSet: [0, 1],
		},
		setup: scene => {
			scene.bench("foo", noop);
			scene.bench("bar", noop);
		},
	});

	expect(context.scenes[0].foo.complexity).toBe("typeA");
	expect(context.scenes[0].bar.complexity).toBe("typeB");
});
