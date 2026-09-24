export * from "./types.js";
export * from "./runner.js";
export * from "./7702.js";
export * from "./7710.js";
export * from "./generic.js";

import { rules7702 } from "./7702.js";
import { rules7710 } from "./7710.js";
import { genericRules } from "./generic.js";
import type { Rule } from "./types.js";

export const allRules: Rule[] = [...rules7702, ...rules7710, ...genericRules];
