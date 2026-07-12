import {describe,expect,it} from "vitest";
import {runAiExploratoryEngine} from "@/src/engine/run-ai-exploratory-engine";
describe("protocol v2 exploratory boundary",()=>{
 it("returns deterministic source navigation without clinical actions",()=>{const input={profile:{medications:["warfarin"]},candidateItems:[{name:"vitamin K"}]};const a=runAiExploratoryEngine(input),b=runAiExploratoryEngine(input);expect(b).toEqual(a);expect(a.scope).toBe("ai_exploratory");expect(a.navigation.map(x=>x.question_id)).toEqual(["A1"]);expect(a.clinical_actions).toEqual([]);expect(JSON.stringify(a)).not.toMatch(/urgent_referral|avoid_until_review|pharmacist_review|validated_thesis_scope/);});
 it("does not partial-match ingredient names",()=>{const out=runAiExploratoryEngine({profile:{},candidateItems:[{name:"vitamin"}]});expect(out.navigation).toEqual([]);expect(out.clinical_actions).toEqual([]);});
});
