# TypeScript

TypeScript is a first-class citizen of ESBench, ESBench's APIs are fully typed, and more than that, ESBench can execute TS files directly!

## Supported Compilers

ESBench uses [ts-directly](https://github.com/Kaciras/ts-directly) to transform TS files, When importing a TS file for the first time, it will detect installed compiler, supports:

- [SWC](https://github.com/swc-project/swc).
- [esbuild](https://github.com/evanw/esbuild).
- [sucrase](https://github.com/alangpierce/sucrase).
- [TypeScript](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#a-simple-transform-function).

These are listed in the peerDependencies and marked as optional, so compilers from other installed packages (e.g. `vite` has dependency `esbuild`) can also be used. **In the vast majority of cases where projects using TypeScript have compiler installed, this feature comes out-of-box.**

If no supported compiler found, the import fails.

ESBench only transforms TS files and does not process other types of imports.

## Run With TypeScript

::: code-group
```typescript [esbench.config.ts]
import { ESBenchConfig, Executor, ProcessExecutor } from "esbench/host";

// TypeScript config file is also supported.
const executors: Executor[] = [new ProcessExecutor("node")];

export default { toolchains: [{ executors }] } satisfies ESBenchConfig;
```
```typescript [benchmark/cartesian-product.ts]
import { defineSuite } from "esbench";

const objectDef: Record<string, any[]> = {
	foo: [11, 22, 33, 44, 55],
	bar: ["abcdefg", "hijklmn"],
	baz: [true, false],
	qux: [1024, 2048, 4096, 8192],
};

function cartesianObject<const T extends Record<string, any[]>>(src: T) {
	const entries = Object.entries(src);
	const temp = {} as Record<string, unknown>;

	function* recursive(index: number): Iterable<unknown> {
		if (index === entries.length) {
			yield { ...temp };
		} else {
			const [key, values] = entries[index];
			for (const value of values) {
				temp[key] = value;
				yield* recursive(index + 1);
			}
		}
	}

	return recursive(0) as Iterable<Record<string, any>>;
}

function drain(generator: Iterable<unknown>) {
	// noinspection StatementWithEmptyBodyJS
	for (const _ of generator) /* No-op */;
}

export default defineSuite(scene => {
	scene.bench("cartesian", () => drain(cartesianObject(objectDef)));
});
```
:::

Just run `esbench`, no new arguments needed, the TS loader is enabled by default.

```shell
esbench --file benchmark/cartesian-product.ts
```

## Use in Executor

[What is Executor?](./toolchains)

ESM loader hooks only act on the current process and are not inherited by spawned processes, so new Node instances started at the executor cannot load TS suites.

To achieve the same behavior, you can register [ts-directly](https://github.com/Kaciras/ts-directly) in Node parameters.

```javascript
import { defineConfig, ProcessExecutor } from "esbench/host";

export default defineConfig({ 
	toolchains: [{
		executors: [
			new ProcessExecutor("node --import ts-directly/register"),
		],
	}],
});
```

::: tip
`PlaywrightExecutor`, `WebextExecutor` and `WebManuallyExecutor` can handle TS files automatically because ESBench intercepts their import requests.
:::

## Customize Loaders

If you prefer other TypeScript loaders (e.g. [ts-node](https://github.com/TypeStrong/ts-node) or [tsx](https://github.com/privatenumber/tsx)), you can disable ESBench's loader with `--no-loader` CLI argument:

```shell
cross-env NODE_OPTIONS="--import ts-node/esm" esbench --no-loader
```
