import {afterEach,describe,expect,it} from "vitest";
import {POST} from "@/app/api/personalized-safety/route";
const original=process.env.OPENAI_API_KEY;
afterEach(()=>{if(original)process.env.OPENAI_API_KEY=original;else delete process.env.OPENAI_API_KEY});
describe("personalized safety API",()=>{
 it.each([["비타민 K","A1","100 mcg/day"],["오메가-3","A2","2000 mg/day"],["칼슘","B1","600 mg/day"],["비타민 D","B2","4000 IU/day"],["비타민 C","B3","1000 mg/day"]])("returns a Korean evidence-linked fallback for %s",async(ingredient,q,dose)=>{delete process.env.OPENAI_API_KEY;const response=await POST(new Request("http://local/api/personalized-safety",{method:"POST",body:JSON.stringify({ingredient,dose,condition:"검토 대상 병력",labs:"검사값 3.1"})}));const body=await response.json();expect(response.status).toBe(200);expect(body.question_id).toBe(q);expect(body.ai_summary).toContain(dose);expect(body.ai_summary).toContain("3.1");expect(body.evidence).toHaveLength(5);expect(body.ai_summary).not.toMatch(/supplement dose|kidney stone|dietary calcium/);});
 it("rejects unsupported ingredients",async()=>{const response=await POST(new Request("http://local/api/personalized-safety",{method:"POST",body:JSON.stringify({ingredient:"마그네슘"})}));expect(response.status).toBe(400);});
});
