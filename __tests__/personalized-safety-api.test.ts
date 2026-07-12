import {afterEach,describe,expect,it,vi} from "vitest";
import {POST} from "@/app/api/personalized-safety/route";
const original=process.env.OPENAI_API_KEY;
afterEach(()=>{vi.restoreAllMocks();if(original)process.env.OPENAI_API_KEY=original;else delete process.env.OPENAI_API_KEY});
describe("personalized safety API",()=>{
 it.each([["비타민 K","A1","100 mcg/day"],["오메가-3","A2","2000 mg/day"],["칼슘","B1","600 mg/day"],["비타민 D","B2","4000 IU/day"],["비타민 C","B3","1000 mg/day"]])("returns a Korean evidence-linked fallback for %s",async(ingredient,q,dose)=>{delete process.env.OPENAI_API_KEY;const response=await POST(new Request("http://local/api/personalized-safety",{method:"POST",body:JSON.stringify({ingredient,dose,condition:"검토 대상 병력",labs:"검사값 3.1"})}));const body=await response.json();expect(response.status).toBe(200);expect(body.question_id).toBe(q);expect(body.ai_summary).toContain(dose);expect(body.ai_summary).toContain("3.1");expect(body.evidence).toHaveLength(5);expect(body.ai_summary).not.toMatch(/supplement dose|kidney stone|dietary calcium/);});
 it("rejects unsupported ingredients",async()=>{const response=await POST(new Request("http://local/api/personalized-safety",{method:"POST",body:JSON.stringify({ingredient:"마그네슘"})}));expect(response.status).toBe(400);});
 it.each([
  ["malformed JSON","{"],
  ["oversized health text",JSON.stringify({ingredient:"칼슘",condition:"가".repeat(201)})],
  ["non-string field",JSON.stringify({ingredient:"칼슘",labs:{value:3.1}})],
 ])("rejects %s",async(_caseName,body)=>{const response=await POST(new Request("http://local/api/personalized-safety",{method:"POST",body}));expect(response.status).toBe(400);expect(response.headers.get("cache-control")).toBe("no-store");});
 it.each([
  ["invented numeric threshold","입력 상태를 확인했습니다. 하루 5000 mg까지 안전합니다. 그대로 복용하세요."],
  ["direct medication instruction","입력 상태를 확인했습니다. 지금 복용을 중단하세요."],
 ])("falls back when AI returns %s",async(_caseName,output_text)=>{process.env.OPENAI_API_KEY="test-key";vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({output_text}),{status:200,headers:{"content-type":"application/json"}}));const response=await POST(new Request("http://local/api/personalized-safety",{method:"POST",body:JSON.stringify({ingredient:"칼슘",dose:"600 mg/day",condition:"신장결석 병력"})}));const body=await response.json();expect(response.status).toBe(200);expect(body.ai_summary).toContain("600 mg/day");expect(body.ai_summary).not.toContain("5000");expect(body.ai_summary).not.toContain("복용을 중단하세요");});
 it("sets an upstream timeout and falls back when the model call fails",async()=>{process.env.OPENAI_API_KEY="test-key";const mocked=vi.spyOn(globalThis,"fetch").mockRejectedValue(new DOMException("timed out","TimeoutError"));const response=await POST(new Request("http://local/api/personalized-safety",{method:"POST",body:JSON.stringify({ingredient:"칼슘",dose:"600 mg/day"})}));const body=await response.json();expect(response.status).toBe(200);expect(body.ai_summary).toContain("600 mg/day");expect(mocked).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({signal:expect.any(AbortSignal)}));});
});
