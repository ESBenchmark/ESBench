import tp from "timers/promises";

export const sleep1 = tp.setTimeout.bind(null, 1);
