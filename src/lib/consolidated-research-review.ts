import summary from "@/research/review_queue/remaining_research_agent_prereview_summary.json";
export const consolidatedBundles=[
 {id:"KOREAMED-SCREENING",title:"KoreaMed 62건",finding:"초록과 native export가 없어 전부 직접 확인 대상으로 남겼습니다.",recommendation:"제목만으로 제외하지 않고 사람 선별 대기열로 유지합니다."},
 {id:"KOREAMED-LINKAGE",title:"KoreaMed–PubMed 35건",finding:"정규화 제목이 정확히 일치하는 링크 후보입니다.",recommendation:"식별자·저자·연도를 확인하기 전에는 연결로 확정하지 않습니다."},
 {id:"SEARCH-GAPS",title:"남은 검색 접근 제약",finding:"RISS 재실행, KMbase 검색식 수정, 구독 DB 인증 export가 남아 있습니다.",recommendation:"현재 결과를 최종 검색으로 주장하지 않고 접근 가능해질 때 원시 export와 checksum을 추가합니다."},
];export const consolidatedTotals=summary;
