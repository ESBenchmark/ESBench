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

export type CurveFn = (x: number) => number;

/**
 * Find the coefficient for the high-order term in the running time, by minimizing
 * the sum of squares of relative error, for the fitting curve given by the `fn`.
 *
 * Source project:
 * https://github.com/ismaelJimenez/cpp.leastsq/blob/master/src/minimal_leastsq.cpp#L66
 *
 * @param input Array containing the size of the benchmark tests.
 * @param time Array containing the times for the benchmark tests.
 * @param fn One variable equation function.
 */
export function minimalLeastSquare(input: number[], time: number[], fn: CurveFn) {
	let sigma_gn_squared = 0;
	let sigma_time = 0;
	let sigma_time_gn = 0;

	for (let i = 0; i < input.length; ++i) {
		const y = fn(input[i]);
		sigma_gn_squared += y * y;
		sigma_time += time[i];
		sigma_time_gn += time[i] * y;
	}

	const coef = sigma_time_gn / sigma_gn_squared;

	let rms = 0;
	for (let i = 0; i < input.length; ++i) {
		const fit = coef * fn(input[i]);
		rms += (time[i] - fit) ** 2;
	}

	return Math.sqrt(rms / input.length) / sigma_time * input.length;
}

type AlternativeHypothesis = "not equal" | "less" | "greater";

/**
 * Perform the Welch's t hypothesis test. return the P-Value.
 * If the samples don't have enough size or their variance are all zero, the result is NaN.
 */
export function welchTest(a: number[], b: number[], alt: AlternativeHypothesis) {
	if (a.length < 2 || b.length < 2) {
		return NaN;
	}
	const seA = sampleVariance(a) / a.length;
	const seB = sampleVariance(b) / b.length;
	const se = seA + seB;

	const t = (mean(a) - mean(b)) / Math.sqrt(se);
	const df = (se ** 2) / (
		(seA ** 2) / (a.length - 1) +
		(seB ** 2) / (b.length - 1)
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

function studentOneTail(t: number, df: number) {
	return t < 0 ? 1 - studentTwoTail(t, df) / 2 : studentTwoTail(-t, df) / 2;
}

// https://www.math.ucla.edu/~tom/distributions/tDist.html
function studentTwoTail(t: number, df: number) {
	const a = df / 2;
	const s = a + 0.5;
	const z = df / (df + t * t);
	const bt = Math.exp(
		logGamma(s) - logGamma(0.5) - logGamma(a)
		+ a * Math.log(z) + 0.5 * Math.log(1 - z),
	);
	if (z < (a + 1) / (s + 2)) {
		return bt * betinc(z, a, 0.5);
	} else {
		return 1 - bt * betinc(1 - z, 0.5, a);
	}
}

function betinc(x: number, a: number, b: number) {
	let a0 = 0;
	let b0 = 1;
	let a1 = 1;
	let b1 = 1;
	let m9 = 0;
	let a2 = 0;
	let c9;
	while (Math.abs((a1 - a2) / a1) > 0.00001) {
		a2 = a1;
		c9 = -(a + m9) * (a + b + m9) * x / (a + 2 * m9) / (a + 2 * m9 + 1);
		a0 = a1 + c9 * a0;
		b0 = b1 + c9 * b0;
		m9 = m9 + 1;
		c9 = m9 * (b - m9) * x / (a + 2 * m9) / (a + 2 * m9 - 1);
		a1 = a0 + c9 * a1;
		b1 = b0 + c9 * b1;
		a0 = a0 / b1;
		b0 = b0 / b1;
		a1 = a1 / b1;
		b1 = 1;
	}
	return a1 / a;
}

function logGamma(z: number) {
	const s = 1 + 76.18009173 / z
		- 86.50532033 / (z + 1)
		+ 24.01409822 / (z + 2)
		- 1.231739516 / (z + 3)
		+ 0.00120858003 / (z + 4)
		- 0.00000536382 / (z + 5);
	return (z - 0.5) * Math.log(z + 4.5)
		- (z + 4.5) + Math.log(s * 2.50662827465);
}
