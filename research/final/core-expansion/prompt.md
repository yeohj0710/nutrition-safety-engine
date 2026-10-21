Task: core evidence review for a dietary-supplement safety literature lookup tool. Work only in this folder (research/final/core-expansion). Do not call any API, do not write keyword or regex heuristics, and do not open files outside this folder. Every judgment must come from your own reading.

Read input.json (104 items). Each item has question_id, question (Korean label of the clinical situation), record_id, title, publication_types, year, and the abstract split into numbered sentences.

For every item decide, from the title and abstract only:

1. decision
   - "retain": the study population is in that clinical situation AND the exposure is an allowed product (dietary supplement, vitamin, mineral, herb, herbal or traditional medicine, fish oil, probiotic, or a nutritional preparation such as oral nutritional supplements or parenteral nutrition), linked directly in human data.
   - "deprioritize": no direct link between the situation and an allowed product; or animal, cell, or mechanism-only work; or only blood levels or status of a nutrient without giving it (biomarker association); or ordinary diet only; or a synthetic prescription drug is the main exposure (for example warfarin, DOACs, heparin, synthetic vitamin D analogues such as paricalcitol or alfacalcidol, calcimimetics, IV iron used as a drug is still allowed as iron).
   - "uncertain": title and abstract conflict so fit cannot be judged.
   Situation-specific notes: HRS1 means people before, during or after surgery, procedures or anesthesia. HRS2 means kidney disease, kidney failure or dialysis. HRS3 means pregnancy, breastfeeding, or fetal or infant exposure through the mother. HRS4 means liver disease or liver failure using supplements, or liver injury caused by supplements. HRS5 means people on anticoagulant or antiplatelet drugs or at bleeding risk; vitamin K given to reverse or stabilise warfarin counts as an allowed product.
2. why_ko: one or two Korean sentences in the same style as these examples: "혈액투석 환자에서 합성 비타민D 수용체 활성제 파리칼시톨과 다른 활성제를 비교한 메타분석이다. 합성 처방약 중심이어서 후순위로 분류했다." / "고혈압을 동반한 급성 허혈성 뇌혈관질환 환자 57명에서 중국 한약 주사제와 heparin을 비교한 임상 연구다. 한약 중재와 항응고 치료의 사람 자료를 연결하므로 유지했다." Do not use the middle dot character; use commas.
3. criterion: a short Korean phrase naming the criterion, for example "P/I 적합성: 신질환, 신부전, 투석 환자와 허용 노출의 직접 연결" or "P/I 부적합성: 합성 처방약 중심".
4. evidence_quote: one sentence copied exactly from the abstract that supports the decision.
5. core_eligible: true only if decision is "retain" AND the abstract has a result or conclusion sentence about that product in that situation that a reader could use.
6. finding_sentence: if core_eligible, the number n of the single sentence that best states the main result for that product in that situation (prefer a RESULTS or CONCLUSIONS sentence with numbers); otherwise null.
7. translation_ko: if core_eligible, a faithful Korean translation of that exact sentence, ending in the polite "~습니다" form, keeping every number, unit, confidence interval, P value, comparison and direction of effect; translate a leading label like "CONCLUSIONS:" as "결론:". Do not add interpretation, do not drop numbers, and do not use the middle dot character. Otherwise null.

Write review.json: one JSON array with one object per input item, in input order, exactly these keys: question_id, record_id, decision, why_ko, criterion, evidence_quote, core_eligible, finding_sentence, translation_ko.

Then validate with a short script: the file parses; it has 104 objects; every (question_id, record_id) pair from input.json appears once; core_eligible is true only with decision retain; finding_sentence is a valid sentence number for that item when core_eligible; every number appearing in that sentence also appears in translation_ko. Fix any failure and revalidate. Do not modify any other file.
