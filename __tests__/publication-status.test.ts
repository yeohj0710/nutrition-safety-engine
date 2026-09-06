import { describe, expect, it, vi } from "vitest";
import { isRetractedPublication } from "@/src/lib/publication-status";

vi.mock("@/src/lib/ai-consult", () => ({ hasConsultKey: () => true, callLuna: vi.fn() }));
import { callLuna } from "@/src/lib/ai-consult";
import { POST as summarizeRecord } from "@/app/api/consult/record/route";
import { POST as compose } from "@/app/api/consult/compose/route";

describe("withdrawn publication records", () => {
  it.each(["Journal Article|Retracted Publication", " Retraction of Publication "])("recognizes %s", (types) => {
    expect(isRetractedPublication(types)).toBe(true);
  });
  it("keeps ordinary metadata and missing types distinct from retractions", () => {
    for (const types of [undefined, "Journal Article|Randomized Controlled Trial", "Published Erratum"])
      expect(isRetractedPublication(types)).toBe(false);
  });
  it("does not send a retracted article to the record summarizer", async () => {
    const response = await summarizeRecord(new Request("http://localhost/api/consult/record", {
      method: "POST", body: JSON.stringify({ publication_types: "Journal Article|Retracted Publication", source_sentence: "Invalid result" }),
    }));
    expect(await response.json()).toEqual({ ok: false, reason: "retracted_source" });
    expect(callLuna).not.toHaveBeenCalled();
  });
  it("omits withdrawn evidence before composing an AI explanation", async () => {
    const response = await compose(new Request("http://localhost/api/consult/compose", {
      method: "POST", body: JSON.stringify({ narrative: ["조회한 서지기록입니다."], evidence: [null, { record_id: "withdrawn-test", title: "Withdrawn trial", publication_types: "Retracted Publication", source_sentence: "Invalid result" }] }),
    }));
    expect(await response.json()).toMatchObject({ source: "deterministic", reason: "no_evidence" });
    expect(callLuna).not.toHaveBeenCalled();
  });
});
