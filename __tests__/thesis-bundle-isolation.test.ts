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
    const claims = thesisBundle.claims as Array<Record<string, unknown>>;
    const rules = thesisBundle.rules as Array<Record<string, unknown>>;

    expect(thesisBundle.meta.sourceNamespace).toBe("data/curated");
    expect(thesisBundle.meta.scope).toBe("validated_thesis_scope");
    expect(thesisBundle.meta.ruleCount).toBe(thesisBundle.rules.length);
    expect(thesisBundle.meta.claimCount).toBe(thesisBundle.claims.length);
    expect(thesisBundle.meta.sourceCount).toBe(thesisBundle.sources.length);
    expect(claims.every((claim) => claim.verification_status === "validated" && claim.scope_status === "validated_thesis_scope")).toBe(true);
    expect(rules.every((rule) => rule.validation_status === "validated" && rule.scope_status === "validated_thesis_scope")).toBe(true);
    expect(JSON.stringify(thesisBundle)).not.toContain("legacy_unverified");
    expect(JSON.stringify(thesisBundle)).not.toContain("synthetic_fixture");
    expect(legacyManifest.status).toBe("legacy_unverified");
    expect(legacyManifest.policy.thesis_bundle_default_include).toBe(false);
    expect(legacyManifest.policy.automatic_validation_promotion).toBe(false);
  });
});
