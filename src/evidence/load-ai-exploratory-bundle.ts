import bundleJson from "@/src/generated/ai-exploratory-bundle.json";
import { aiExploratoryBundleSchema, type AiExploratoryBundle } from "@/src/domain/ai-exploratory";
let cached:AiExploratoryBundle|undefined;
export function loadAiExploratoryBundle(){cached??=aiExploratoryBundleSchema.parse(bundleJson);return cached;}
