# Run Examples

To run examples (files in the `example` folder), you need to build ESBench first:

```shell
pnpm build
```

It is recommended to run one suite at a time using `--file` parameter, as it can take a long time.

```shell
cd example
pnpm exec esbench --filer <filename.js>
```
