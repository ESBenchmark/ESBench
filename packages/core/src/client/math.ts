import { mean, quantileSorted, sampleVariance } from "simple-statistics";

export type OutlierMode = "upper" | "lower" | "all";

export class TukeyOutlierDetector {

	readonly lowerFence: number;
	readonly upperFence: number;

	/**
	 * Create a new outlier detector using Tukey's Fences.
	 *
	 * @param values Sample array, muse be sorted.
	 * @param k The K value.
	 */
	constructor(values: number[], k = 1.5) {
		if (values.length === 0) {
			throw new Error("values should be non-empty");
		}
		const Q1 = quantileSorted(values, 0.25);
		const Q3 = quantileSorted(values, 0.75);
		const IQR = Q3 - Q1;
		this.lowerFence = Q1 - k * IQR;
		this.upperFence = Q3 + k * IQR;
	}

	isOutlier(value: number) {
		return value < this.lowerFence || value > this.upperFence;
	}

	/**
	 * Creates a copy of the given array without outliers.
	 *
	 * @param values The array filter() was called upon.
	 * @param mode Specifies which outliers should be removed from the distribution.
	 */
	filter(values: number[], mode: OutlierMode = "all") {
		switch (mode) {
			case "lower":
				return values.filter(v => v >= this.lowerFence);
			case "upper":
				return values.filter(v => v <= this.upperFence);
			default:
				return values.filter(v => !this.isOutlier(v));
		}
	}
}

type AlternativeHypothesis = "not equal" | "less" | "greater";

/**
 * Perform the Welch's t hypothesis test. return the P-Value.
 * If the samples don't have enough size or their variance are all zero, the result is NaN.
 */
export function welchTTest(a: number[], b: number[], alt: AlternativeHypothesis) {
	if (a.length < 2 || b.length < 2) {
		return NaN;
	}

	const leftSE = sampleVariance(a) / a.length;
	const rightSE = sampleVariance(b) / b.length;
	const se = leftSE + rightSE;

	const t = (mean(a) - mean(b)) / Math.sqrt(se);
	const df = (se ** 2) / (
		(leftSE ** 2) / (a.length - 1) +
		(rightSE ** 2) / (b.length - 1)
	);

	switch (alt.charCodeAt(0)) {
		case 110: /* not equal */
			return studentTwoTail(t, df);
		case 108: /* less */
			return 1 - studentOneTail(t, df);
		case 103: /* greater */
			return studentOneTail(t, df);
	}
	throw new TypeError(`Invalid alternative hypothesis: "${alt}"`);
}

function studentOneTail(t: number, df: number): number {
	if (t < 0) {
		return 1 - studentTwoTail(t, df) / 2;
	}
	return 1 - studentOneTail(-t, df);
}

function studentTwoTail(t: number, df: number) {
	const g = Math.exp(logGamma(df / 2.0) + logGamma(0.5) - logGamma(df / 2.0 + 0.5));
	const b = df / (t * t + df);

	function f(r: number) {
		return Math.pow(r, df / 2.0 - 1.0) / Math.sqrt(1.0 - r);
	}

	// n = 10000 seems more than enough here.
	return simpson(0.0, b, 10000, f) / g;
}

function simpson(a: number, b: number, n: number, f: (r: number) => number) {
	const h = (b - a) / n;
	let sum = 0.0;
	for (let i = 0; i < n; i++) {
		const x = a + i * h;
		sum += (f(x) + 4.0 * f(x + h / 2.0) + f(x + h)) / 6.0;
	}
	return sum * h;
}

function logGamma(z: number) {
	const S = 1 + 76.18009173 / z
		- 86.50532033 / (z + 1)
		+ 24.01409822 / (z + 2)
		- 1.231739516 / (z + 3)
		+ 0.00120858003 / (z + 4)
		- 0.00000536382 / (z + 5);
	return (z - 0.5) * Math.log(z + 4.5)
		- (z + 4.5) + Math.log(S * 2.50662827465);
}
