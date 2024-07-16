# Frequently Asked Questions

[[TOC]]

## Does ESBench measure memory allocation?

How much memory a function allocates at runtime is an important metric, fewer allocations means lower GC pressure and better performance. We really wanted to have this feature in core.

**But it's impossible,** because GC runs in the background and it interferes with the memory usage statistics. In order to get the reliable value, we must either pause GC or find an API that counts allocations, unfortunately, none of the popular JavaScript runtimes support this.
