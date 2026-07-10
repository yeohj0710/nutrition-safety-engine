import { readFileSync } from "node:fs";
import path from "node:path";

import thesisBundle from "@/src/generated/thesis-bundle.json";
import { describe, expect, it } from "vitest";

type LegacyManifest = {
  status: string;
  policy: {
    thesis_bundle_default_include: boolean;
    automatic_validation_promotion: boolean;
  };
};

describe("thesis bundle isolation", () => {
  it("builds only from curated data and excludes every legacy record by default", () => {
    const manifestPath = path.join(
      process.cwd(),
      "data",
      "legacy_unverified",
      "manifest.json",
    );
    const legacyManifest = JSON.parse(
      readFileSync(manifestPath, "utf8"),
    ) as LegacyManifest;

    expect(thesisBundle.meta.sourceNamespace).toBe("data/curated");
    expect(thesisBundle.meta.scope).toBe("validated_thesis_scope");
    expect(thesisBundle.meta.ruleCount).toBe(0);
    expect(thesisBundle.meta.claimCount).toBe(0);
    expect(thesisBundle.rules).toEqual([]);
    expect(thesisBundle.claims).toEqual([]);
    expect(legacyManifest.status).toBe("legacy_unverified");
    expect(legacyManifest.policy.thesis_bundle_default_include).toBe(false);
    expect(legacyManifest.policy.automatic_validation_promotion).toBe(false);
  });
});
