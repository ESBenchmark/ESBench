export function randomNumbers(length) {
	return Array.from({ length }, () => Math.random() * 2);
}
