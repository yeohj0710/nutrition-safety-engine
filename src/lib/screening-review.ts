export type ScreeningBundle = { id:string; question:string; title:string; count:number; withAbstract:number; recommendation:string; safeguards:string[] };
export const screeningBundles: ScreeningBundle[] = [
  {id:"SCREEN-A1",question:"A1",title:"비타민 K와 항응고제",count:12234,withAbstract:11219,recommendation:"영양·보충·섭취 변화와 항응고 상태의 관련성을 우선 선별하고, 치료 목적 reversal 및 영양 노출이 없는 항응고제 일반 문헌은 제외 후보로 분류합니다.",safeguards:["초록 없는 1,015건은 자동 제외하지 않음","reversal 문헌은 별도 사유 기록","불확실하면 보류"]},
  {id:"SCREEN-A2",question:"A2",title:"오메가-3와 항응고제",count:820,withAbstract:811,recommendation:"EPA·DHA·어유 노출과 출혈·응고·INR 관련 결과를 우선 선별합니다. 약어 오탐과 영양 노출이 없는 항응고제 문헌은 제외 후보로 분류합니다.",safeguards:["약어만으로 자동 포함하지 않음","초록 없는 9건 보류","불확실하면 보류"]},
  {id:"SCREEN-B1",question:"B1",title:"칼슘 보충제와 결석",count:1355,withAbstract:1013,recommendation:"칼슘 보충제 또는 복용량과 신장·요로결석 결과가 함께 확인되는 문헌을 우선 선별하고, 식이 칼슘만 다룬 문헌은 별도 판정합니다.",safeguards:["보충제와 식이 노출 구분","초록 없는 342건 보류","불확실하면 보류"]},
  {id:"SCREEN-B2",question:"B2",title:"비타민 D와 결석",count:4882,withAbstract:4398,recommendation:"비타민 D 보충과 결석·고칼슘뇨 결과가 연결된 문헌을 우선 선별합니다. 결석과 무관한 hypercalcemia 문헌은 제외 후보로 분류합니다.",safeguards:["결석 또는 요중 칼슘 결과 확인","초록 없는 484건 보류","불확실하면 보류"]},
  {id:"SCREEN-B3",question:"B3",title:"비타민 C와 결석",count:680,withAbstract:584,recommendation:"비타민 C·ascorbic acid 노출과 결석·옥살산뇨 결과가 함께 있는 문헌을 우선 선별하고 성별은 추출 단계에서 기록합니다.",safeguards:["성별로 검색 결과를 임의 제외하지 않음","초록 없는 96건 보류","불확실하면 보류"]}
];
