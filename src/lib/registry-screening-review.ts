import summary from "@/research/review_queue/registry_screening_agent_prereview_summary.json";
export type RegistryBundle={id:string;questionId:string;title:string;records:number;advance:number;uncertain:number;likelyExclude:number;note:string};
const titles={A1:"와파린과 비타민 K",A2:"항응고제와 오메가-3",B1:"칼슘 보충제와 요로결석",B2:"비타민 D와 요로결석",B3:"비타민 C와 요로결석"} as const;
export const registryBundles:RegistryBundle[]=(Object.keys(titles) as Array<keyof typeof titles>).map(questionId=>{const q=summary.questions[questionId];const recommendations=q.recommendations as Record<string,number>;return{id:`REGISTRY-${questionId}`,questionId,title:titles[questionId],records:q.records,advance:recommendations.advance_to_human_registry_screening??0,uncertain:recommendations.uncertain_manual_review??0,likelyExclude:recommendations.likely_exclude_needs_validation??0,note:questionId==="A1"?"비타민 K 길항제 어휘 위험 139건을 별도로 확인했습니다.":"구조화된 등록정보의 노출·결과 신호를 보수적으로 비교했습니다."}});
export const registryTotals=summary;
