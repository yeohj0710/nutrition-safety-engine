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
it("accepts the same amount when the abstract spells the unit out or pluralises it", () => {
  // 실측: 초록의 "15 gs of raw herbs" 를 모델이 "15 g" 으로 옮겨 쓰자 문단이 떨어졌다.
  expect(refereeConsult({ paragraphs:[{text:"이 연구는 하루 15 g에 해당하는 양을 썼습니다.",recordIds:["A"]}], recordText:{A:"add-on oral astragalus granules (15 gs of raw herbs daily equivalent)"},sharedText:"" }).ok).toBe(true);
  expect(refereeConsult({ paragraphs:[{text:"출생 체중은 1400 g이었습니다.",recordIds:["A"]}], recordText:{A:"weighing 1,400 grams (about 3 pounds)"},sharedText:"" }).ok).toBe(true);
  // 단위를 바꿔 쓰는 것은 그대로 막는다.
  expect(refereeConsult({ paragraphs:[{text:"하루 15 mg을 썼습니다.",recordIds:["A"]}], recordText:{A:"15 gs of raw herbs daily"},sharedText:"" }).ok).toBe(false);
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
