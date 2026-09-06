import { expect, it } from "vitest";
import { refereeConsult } from "@/src/lib/consult-referee";
import { evidenceFallback, loadConsultSources } from "@/src/lib/consult-evidence";

it("rejects qualitative claims without an identifiable paper", () => {
  const verdict=refereeConsult({paragraphs:[{text:"이 연구에서 피로가 개선됐습니다.",recordIds:[]}],recordText:{A:"Fatigue improved."},sharedText:""});
  expect(verdict.ok).toBe(false);
  if(!verdict.ok) expect(verdict.rejections).toContain("missing_source:0");
});

it("accepts equivalent decimal spelling in a cited study", () => {
  expect(refereeConsult({ paragraphs:[{text:"이 연구에서는 13개월을 관찰했습니다.",recordIds:["A"]}], recordText:{A:"Follow-up lasted 13.0 months."},sharedText:"" }).ok).toBe(true);
});
it("rejects a changed dose unit even when the number exists", () => {
  expect(refereeConsult({ paragraphs:[{text:"연구에서 5 g을 사용했습니다.",recordIds:["A"]}], recordText:{A:"The dose was 5 mg."},sharedText:"" }).ok).toBe(false);
});
it("loads only question-bound source records and provides a substantive fallback", async () => {
  const sources=await loadConsultSources("HRS1_PERIOPERATIVE",["pubmed:41114550","invented"]);
  expect(sources).toHaveLength(1);
  expect(sources[0].abstract.length).toBeGreaterThan(300);
  // 대체 문단은 결과 문장을 사람 말로 다듬는다(약어 뜻 붙이기, 통계 괄호 제거).
  // 문장의 앞머리는 그대로 남아야 어느 결과를 옮긴 것인지 알 수 있다.
  const fallback = evidenceFallback(sources, "수술 전후", { conditionLine: "나이" });
  expect(fallback[0].recordIds).toEqual([sources[0].recordId]);
  expect(fallback[0].text).toContain("수술 전후");
  expect(fallback[0].text).toContain(sources[0].findingKo.split(/[(,]/)[0].slice(0, 12));
  expect(await loadConsultSources("../../etc",["pubmed:41114550"])).toEqual([]);
});
