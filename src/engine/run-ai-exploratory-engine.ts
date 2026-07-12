import {createHash} from "node:crypto";
import {AI_EXPLORATORY_SCOPE,aiExploratoryResponseSchema,thesisQuerySchema,type AiExploratoryBundle,type AiExploratoryResponse} from "@/src/domain/ai-exploratory";
import {loadAiExploratoryBundle} from "@/src/evidence/load-ai-exploratory-bundle";
const norm=(v:string)=>v.trim().toLocaleLowerCase("en-US");
export function runAiExploratoryEngineWithBundle(input:unknown,bundle:AiExploratoryBundle):AiExploratoryResponse{
 const query=thesisQuerySchema.parse(input);const terms=[...new Set(query.candidateItems.map(x=>norm(x.name)))].sort();
 const matches=bundle.rules.filter(rule=>rule.trigger_terms.some(t=>terms.includes(norm(t)))).sort((a,b)=>a.question_id.localeCompare(b.question_id));
 const claims=new Map(bundle.claims.map(c=>[c.claim_id,c]));const digest=createHash("sha256").update(`${bundle.meta.bundleVersion}\n${JSON.stringify(terms)}`).digest("hex").slice(0,24);
 return aiExploratoryResponseSchema.parse({request_id:`v2_${digest}`,scope:AI_EXPLORATORY_SCOPE,bundle_version:bundle.meta.bundleVersion,normalized_terms:terms,navigation:matches.map(r=>{const c=claims.get(r.claim_id)!;return{question_id:r.question_id,claim_id:c.claim_id,message:`${c.statement} 이는 AI 탐색 분류이며 임상 결론이 아닙니다.`,record_question_units:c.record_question_units,source_counts:c.source_counts,classification_counts:c.classification_counts,support:c.support};}),clinical_actions:[],limitations:["AI 기반 탐색적 문헌지도이며 체계적 문헌고찰이나 임상 권고가 아닙니다.","사람 선별·RoB·GRADE·독립 임상 검증을 수행하지 않았습니다."]});
}
export function runAiExploratoryEngine(input:unknown){return runAiExploratoryEngineWithBundle(input,loadAiExploratoryBundle());}
