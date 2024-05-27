# Configuration

When running ESBench from the command line, ESBench will automatically try to resolve a config file named `esbench.config.js` inside current working directory.

The most basic config file looks like this:

```javascript
import { defineConfig } from "esbench/host";

export default defineConfig({
	// config options...
});
```

The full type of configuration can be found at [config.ts](https://github.com/ESBenchmark/ESBench/blob/master/core/src/host/config.ts)

You can also explicitly specify a config file to use with the `--config` CLI option:

```shell
esbench --config my-config.js
```
