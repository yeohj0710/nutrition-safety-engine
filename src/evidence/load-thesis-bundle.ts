import thesisBundleJson from "@/src/generated/thesis-bundle.json";
import {
  thesisBundleSchema,
  type ThesisBundle,
} from "@/src/domain/thesis";

let cachedBundle: ThesisBundle | undefined;

export function loadThesisBundle(): ThesisBundle {
  cachedBundle ??= thesisBundleSchema.parse(thesisBundleJson);
  return cachedBundle;
}
