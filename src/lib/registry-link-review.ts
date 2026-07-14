import summary from "@/research/review_queue/registry_pubmed_link_agent_prereview_summary.json";
export const registryLinkBundles=[
 {id:"REG-LINK-RESULT",title:"결과 참고문헌",count:summary.reference_types.RESULT,recommendation:"해당 임상시험의 직접 결과 보고서 가능성이 높은 후보로 우선 확인합니다.",note:"등록자료에서 RESULT로 명시된 연결입니다."},
 {id:"REG-LINK-DERIVED",title:"파생 참고문헌",count:summary.reference_types.DERIVED,recommendation:"후속 분석·도구 논문·직접 결과 보고서를 사람이 구분합니다.",note:"같은 시험에서 파생됐어도 모든 논문이 동일 역할은 아닙니다."},
 {id:"REG-LINK-BACKGROUND",title:"배경 참고문헌",count:summary.reference_types.BACKGROUND,recommendation:"연구 배경 자료일 가능성이 높지만 개별 연결을 최종 거절하기 전에 확인합니다.",note:"배경 인용을 해당 시험 보고서로 자동 연결하지 않습니다."},
];export const registryLinkTotals=summary;
