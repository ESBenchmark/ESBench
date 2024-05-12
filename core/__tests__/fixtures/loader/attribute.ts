import packageJson from "../result-0.json" with { type: "json" };

if (packageJson) {
	process.stdout.write("Hello World" as const);
}
