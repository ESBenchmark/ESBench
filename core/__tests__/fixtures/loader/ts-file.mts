import { stdout } from "process";

// `as const` makes it invalid for JS.
stdout.write("Hello World" as const);
