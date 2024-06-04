# TypeScript

TypeScript is a first-class citizen of ESBench, ESBench's APIs are fully typed, and more than that, ESBench can execute TS files directly!

## Supported Compilers

When started, ESBench installs an [ESM Loader Hooks](https://nodejs.org/docs/latest/api/module.html#customization-hooks) to transform TS files.

When importing a TS file for the first time, ESBench will detect installed compilers use the following steps:

1. If `@swc/core` installed, use [SWC](https://github.com/swc-project/swc).
2. If `esbuild` installed, use [esbuild](https://github.com/evanw/esbuild) .
3. If `typescript` installed, use [TypeScript](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#a-simple-transform-function).
4. No supported compiler, the import fails.

ESBench only transforms TS files and does not process other types of imports.

In the vast majority of cases where projects using TypeScript have typescript installed, this feature comes out of box.

## Run With TypeScript

::: code-group
```typescript [esbench.config.ts]
// TypeScript config file is also supported.
import { ESBenchConfig, Executor, ProcessExecutor } from "esbench/host";

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

ESM loader hooks only act on the current process and are not inherited by spawned processes, so new Node instances started at the executor cannot load TS suites.

To achieve the same behavior, you can use [ts-directly](https://github.com/Kaciras/ts-directly).

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
`PlaywrightExecutor` and `WebextExecutor` can handle TS files because ESBench intercepts their import requests.
:::

## Customize Loaders

If you prefer other TypeScript loaders (e.g. [ts-node](https://github.com/TypeStrong/ts-node) or [tsx](https://github.com/privatenumber/tsx)), you can disable ESBench's loader with `--no-loader` CLI argument:

```shell
cross-env NODE_OPTIONS="--import ts-node/esm" esbench --no-loader
```
