const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d")!;

// https://github.com/ashiguruma/patternomaly/blob/master/src/shapes/diagonal.js
export function diagonalPattern(background: string, size = 20) {
	const halfSize = size / 2;
	canvas.width = size;
	canvas.height = size;

	ctx.fillStyle = background;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.beginPath();
	ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
	ctx.lineJoin = "round";
	ctx.lineCap = "round";
	ctx.lineWidth = size / 10;

	drawDiagonalLine(size);
	drawDiagonalLine(size, halfSize, halfSize);
	ctx.closePath();

	ctx.stroke();
	return ctx.createPattern(canvas, null)!;
}

function drawDiagonalLine(size: number, offsetX = 0, offsetY = 0) {
	const halfSize = 20 / 2;
	const gap = 1;
	ctx.moveTo((halfSize - gap) - offsetX, (gap * -1) + offsetY);
	ctx.lineTo((size + 1) - offsetX, (halfSize + 1) + offsetY);
}
