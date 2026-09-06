"use client";

import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatedDetails } from "@/src/components/animated-details";
import { InfoTip } from "@/src/components/info-tip";
import { isRetractedPublication, retractedPublicationNotice } from "@/src/lib/publication-status";
import { elapsedLabel, readConsultResponse } from "@/src/lib/consult-stream";
import {
  axes,
  axisById,
  evidenceOnlyDisclaimer,
  situations,
  type AxisId,
  type SituationId,
} from "@/src/lib/clinical-situations";
import { publicInputExamples } from "@/src/lib/personalized-safety-examples";
import { axisCoverage, coreCoverage } from "@/src/lib/axis-coverage";
import {
  flattenTranslatedFindings,
  splitEvidenceSentences,
} from "@/src/lib/evidence-sentences";

type EvidenceItem = {
  record_id: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  url: string;
  source_locator: string;
  source_sentence: string;
  source_scope: "abstract_only" | "title_only";
  key_finding: string;
  key_finding_ko: string;
  publication_types: string;
  dose: string;
  population: string;
  outcome: string;
  translation_authorship: "ai_generated" | null;
  sentence_role:
    | "result_or_conclusion"
    | "background_or_methods"
    | "unclassified";
};

type AppliedAxis = {
  axis: AxisId;
  field: string;
  value: string;
  reported: number;
};

type ApiResult = {
  situation: SituationId;
  situation_label: string;
  research_question: string;
  applied_axes: AppliedAxis[];
  ignored_axes: AppliedAxis[];
  unavailable_axes: { axis: AxisId; field: string; value: string }[];
  core_evidence_count: number;
  evidence: EvidenceItem[];
  evidence_total_after_filter: number;
  evidence_summary: {
    displayed_records: number;
    unique_titles: number;
    source_scope: { abstract_only: number; title_only: number };
    ai_extracted_sentences: number;
    title_derived_records: number;
    ai_translated_sentences: number;
  };
  matching_basis:
    | "metadata_axis_presence"
    | "metadata_axis_presence_extended"
    | "question_core_evidence"
    | "expanded_question_corpus";
  filter_mode: "metadata_axis_presence" | "core";
  filter_trace: { axis: AxisId | "base"; label: string; count: number }[];
  query_snapshot: {
    situation: SituationId;
    requested_axes: AxisId[];
    active_axes: AxisId[];
  };
  checks: string[];
  summary: string;
  narrative?: string[];
  patient_context?: string;
  disclaimer: string;
  expanded: boolean;
  expanded_offset: number;
  expanded_page_size: number;
  core_shown: number;
  extended_shown: number;
  extended_total: number;
  extended_pool_total: number;
  extended_match_total: number;
  extended_note: string;
  error?: string;
};

type FormState = {
  situation: SituationId | "";
  axes: AxisId[];
};

const emptyForm: FormState = { situation: "", axes: [] };
const SUMMARY_SENTENCE_LIMIT = 3;

/** 문장 정리기가 돌려주는 것. 값이 아니라 어떤 축을 켤지만 화면에 반영한다. */
type Interpreted = {
  situation: SituationId | null;
  applied_axes: { axis: AxisId; field: string; value: string }[];
  unavailable_axes: { axis: AxisId; field: string; value: string }[];
  unmatched: string;
  notice: string;
  error?: string;
};

/** 결과 해설. AI 가 쓴 것과 시스템이 계산한 것을 화면에서 구분해 표시한다.
 *  문단마다 근거로 삼은 기록 번호를 들고 있어 출처를 그 자리에서 보여준다. */
type ConsultParagraph = { text: string; recordIds: string[] };
type ConsultText = {
  paragraphs: ConsultParagraph[];
  source: "ai_written" | "deterministic";
  reason?: string;
  /** interim = 모델을 기다리는 동안 서버 원자료로 정리한 문단, final = 확정된 문단. */
  stage?: "interim" | "final";
  /** AI 해설이 붙은 뒤에도 접어 두는 문헌별 정리. */
  interim?: ConsultParagraph[];
  elapsedMs?: number;
} | null;

/**
 * 결과 해설이 결정론 문단으로 떨어진 까닭을 사람 말로 옮긴다.
 *
 * 배지만 "자동 생성"으로 바뀌면 두 상황이 한 모양이 된다. 이 서버에 애초에
 * 작성 기능이 없는 것과, 이번 호출이 실패한 것. 둘은 사용자가 할 일이 다르다.
 */
function consultFallbackReason(reason?: string) {
  if (!reason) return "";
  if (reason === "no_key")
    return "해설 작성 기능이 연결되지 않아 문헌에서 확인한 결과 문장을 표시합니다.";
  if (reason === "no_evidence")
    return "해설에 연결할 문헌이 없습니다. 선택한 조건을 넓혀 다시 조회하세요.";
  if (reason === "refereed_out")
    return "AI 해설이 출처 확인 기준을 통과하지 못했습니다. 문헌에서 확인한 결과 문장을 대신 표시합니다.";
  if (reason === "timeout")
    return "AI 해설을 기다리는 시간이 길어져 서버가 정리한 문헌별 내용을 표시합니다. 다시 조회하면 해설을 다시 요청합니다.";
  if (reason === "rate_limited")
    return "요청이 잠시 몰려 AI 해설을 쉬어 갑니다. 서버가 정리한 문헌별 내용을 표시합니다. 잠시 뒤 다시 조회할 수 있습니다.";
  return "AI 해설을 받지 못해 서버가 정리한 문헌별 내용을 표시합니다. 다시 조회하면 해설을 다시 요청합니다.";
}

/** 카드 안에서 반복되는 버튼 모양. 높이와 모서리를 한곳에서 정한다. */
const buttonBase =
  "inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] px-5 text-[0.9375rem] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const buttonPrimary = `${buttonBase} bg-accent text-white hover:bg-accent-strong`;
const buttonQuiet = `${buttonBase} border border-border-strong bg-surface text-foreground hover:bg-surface-elevated`;

/** 한꺼번에 N개까지만 부른다. 12건을 동시에 보내면 해설 호출과 자리를 다툰다. */
async function runLimited<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function sortedAxes(values: AxisId[]) {
  return [...values].sort().join("|");
}

function isSameQuery(form: FormState, result: ApiResult) {
  return (
    form.situation === result.query_snapshot.situation &&
    sortedAxes(form.axes) === sortedAxes(result.query_snapshot.requested_axes)
  );
}

/**
 * 화면에 쓰는 말.
 *
 * 도구가 자기 내부 이름(표현, 필터, 축, metadata_axis_presence)을 그대로
 * 읽으면 사람에게 하는 말이 아니다. 숫자는 그대로 두고 부르는 이름만 사람이
 * 쓰는 말로 적는다.
 */
function resultCountLabel(result: ApiResult) {
  if (result.expanded) {
    const first = result.evidence.length ? result.expanded_offset + 1 : 0;
    const last = result.expanded_offset + result.evidence.length;
    const scope = result.applied_axes.length
      ? "조건에 맞는 문헌"
      : "이 상황의 문헌";
    return `${scope} ${result.extended_total.toLocaleString("ko-KR")}건 중 ${first}~${last}번째`;
  }
  // 핵심 근거가 모자라 넓혀 찾은 문헌으로 채운 화면에서는 두 층을 갈라 적는다.
  // 세 자리(머리 라벨, 표시 건수 타일, 조건 빼기 제안)가 같은 뜻의 숫자를 쓴다.
  if (result.extended_shown > 0) {
    return `핵심 ${result.core_shown.toLocaleString("ko-KR")}건 + 넓혀 찾은 ${result.extended_shown.toLocaleString("ko-KR")}건`;
  }
  if (result.filter_mode === "metadata_axis_presence") {
    return `조건에 맞는 핵심 ${result.evidence_total_after_filter.toLocaleString("ko-KR")}건`;
  }
  return `핵심 근거 ${result.evidence_total_after_filter.toLocaleString("ko-KR")}건`;
}

function resultHeading(result: ApiResult) {
  if (!result.expanded && result.extended_shown > 0)
    return "조건에 맞는 문헌";
  if (result.expanded)
    return result.applied_axes.length
      ? "조건에 맞는 문헌 전체"
      : "이 상황의 문헌 전체";
  if (result.filter_mode === "metadata_axis_presence")
    return "조건에 맞는 핵심 문헌";
  return "이 상황의 핵심 문헌";
}

function resultBasisCopy(result: ApiResult) {
  if (!result.expanded && result.extended_shown > 0)
    return `검토를 마친 핵심 문헌 ${result.core_shown}건에 AI가 선별한 후보 ${result.extended_shown}건을 더했습니다. 추가 후보는 주제, 요약, 번역을 개별 검토하지 않았으며 영어 초록 문장을 그대로 표시합니다. 조건은 초록에 그 항목이 나오는지만 확인하고, 입력한 값과 논문의 값을 대조하지 않습니다.`;
  if (result.expanded)
    return result.applied_axes.length
      ? `이 상황의 후보 ${result.extended_pool_total.toLocaleString("ko-KR")}건에 같은 조건을 적용했습니다. 핵심 목록 밖의 후보는 주제, 요약, 번역을 개별 검토하지 않은 자료입니다. 조건은 초록에 그 항목이 나오는지만 확인하며, 값을 논문 내용과 맞춰 보지는 않습니다.`
      : "이 상황의 후보를 30건씩 보여드립니다. 핵심 목록 밖의 후보는 주제, 요약, 번역을 개별 검토하지 않은 자료입니다.";
  if (result.filter_mode === "metadata_axis_presence")
    return "선택한 조건이 초록에 나오는지만 확인합니다. 연령이나 용량 값을 논문 내용과 하나하나 대조하지는 않습니다.";
  return "조건 없이 이 상황의 핵심 문헌을 표시합니다. 연구 질문마다 정한 순서로 골라 보여줍니다.";
}

function resultStatusMessage(result: ApiResult) {
  if (result.expanded) {
    const scope = result.applied_axes.length
      ? "조건에 맞는 문헌"
      : "이 상황의 문헌";
    if (!result.evidence.length)
      return `${scope} ${result.extended_total.toLocaleString("ko-KR")}건 가운데 보여드릴 것이 없습니다.`;
    const first = result.expanded_offset + 1;
    const last = result.expanded_offset + result.evidence.length;
    return `${scope} ${result.extended_total.toLocaleString("ko-KR")}건 가운데 ${first}번째부터 ${last}번째까지 보여드립니다.`;
  }
  if (result.extended_shown > 0) {
    return `핵심 문헌 ${result.core_shown}건에 넓혀 찾은 ${result.extended_shown}건을 더해 모두 ${result.evidence.length}건을 보여드립니다.`;
  }
  return `${result.evidence.length}건을 보여드립니다.`;
}

function locatorLabel(locator: string, sourceScope: EvidenceItem["source_scope"]) {
  if (sourceScope === "title_only" || locator === "TITLE") return "제목에서만 확인";
  const match = /^ABSTRACT_SENTENCE_(\d+)$/.exec(locator);
  return match ? `초록 ${match[1]}번째 문장` : locator || "초록 문장";
}

function sentenceRoleLabel(role: EvidenceItem["sentence_role"]) {
  if (role === "result_or_conclusion") return "결과 또는 결론 문장";
  if (role === "background_or_methods") return "배경 또는 방법 문장, 결과 아님";
  return "문장 위치 미분류";
}

/** 요약 타일 한 칸. 라벨 줄 높이를 고정해 세 칸의 숫자 높이를 맞춘다. */
function SummaryTile({
  label,
  value,
  unit,
  note,
  tip,
}: {
  label: string;
  value: number;
  unit: string;
  note?: string;
  tip?: ReactNode;
}) {
  return (
    <div className="inset-block inset-block-quiet">
      <dt className="flex min-h-5 items-center gap-1.5 text-[0.8125rem] font-bold text-muted">
        {label}
        {tip}
      </dt>
      <dd className="mt-2">
        <span className="text-[1.5rem] font-bold leading-none tabular-nums text-foreground">
          {value.toLocaleString("ko-KR")}
        </span>
        <span className="ml-0.5 text-sm font-bold text-muted">
          {unit}
        </span>
        {note ? (
          <span className="mt-1.5 block text-[0.8125rem] leading-5 text-muted">
            {note}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function EvidenceFinding({
  item,
  number,
  sentence,
  sentenceIndex,
}: {
  item: EvidenceItem;
  number: number;
  sentence: string;
  sentenceIndex: number;
}) {
  const kind = item.publication_types.split("|")[0] || "연구유형 미표시";

  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-t border-border-subtle py-4 first:border-t-0">
      {/* 항목마다 span 을 끊고 그 사이에 구분자를 두면 쉼표 앞에도 flex 간격이
          붙는다. 쉼표는 앞말에 붙여야 한다. */}
      <p className="col-span-2 flex flex-wrap items-center gap-x-2 text-[0.8125rem] font-bold text-navy">
        <span>AI 자동 번역,</span>
        <span>{item.year || "연도 미표시"},</span>
        <span>{kind},</span>
        <span>문장 {sentenceIndex + 1}</span>
      </p>
      {/* 터치 영역 44px 은 유지하고 ref-hit 의 음수 여백으로 배치 폭만 1.5rem 으로
          되돌린다. 번호 배지가 본문 첫 줄과 같은 높이에서 시작한다. */}
      <a
        href={`#result-ref-${number}`}
        aria-label={`${number}번 문헌의 ${sentenceIndex + 1}번째 문장 출처로 이동`}
        className="ref-hit flex min-h-11 min-w-11 items-center justify-center no-underline"
      >
        <span className="ref-badge bg-navy text-white">{number}</span>
      </a>
      <p className="text-[0.9375rem] leading-6 text-foreground">{sentence}</p>
      <p lang="en" className="col-start-2 break-words text-[0.8125rem] leading-5 text-muted">
        {item.title}
      </p>
    </li>
  );
}

function ResultSkeleton() {
  return (
    <div aria-hidden="true" className="card motion-enter flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="h-5 w-5 animate-spin rounded-full border-2 border-accent/25 border-t-accent"
        />
        <p className="text-[0.9375rem] font-bold text-foreground">
          선택한 조건으로 문헌을 조회하는 중
        </p>
      </div>
      <div aria-hidden="true" className="grid gap-2">
        <span className="loading-skeleton block h-4 w-4/5 rounded" />
        <span className="loading-skeleton block h-4 w-3/5 rounded" />
      </div>
    </div>
  );
}

function EvidenceRecord({
  item,
  number,
  plainLine,
  pendingLine,
}: {
  item: EvidenceItem;
  number: number;
  /** 한국어 번역이 없는 확장 근거에만 붙는 한 줄 요약. */
  plainLine?: string;
  /** 그 한 줄이 아직 오는 중인지. 자리만 잡아 두고 빈 카드로 두지 않는다. */
  pendingLine?: boolean;
}) {
  const metadata = [
    item.authors,
    item.venue,
    item.year ? String(item.year) : "",
    item.publication_types.split("|")[0],
  ].filter(Boolean);
  const locator = locatorLabel(item.source_locator, item.source_scope);

  if (isRetractedPublication(item.publication_types)) {
    return (
      <li id={`result-ref-${number}`} className="evidence-record scroll-mt-24 py-5">
        <p className="text-sm font-bold text-warning">철회 상태, 서지기록</p>
        <a href={item.url} target="_blank" rel="noreferrer" lang="en"
          className="mt-2 block break-words text-base font-bold underline">
          {number}. {item.title}
        </a>
        <p lang="en" className="mt-1.5 break-words text-sm text-muted">{metadata.join(", ")}</p>
        <p className="mt-2 text-sm leading-6">{retractedPublicationNotice}</p>
      </li>
    );
  }

  return (
    <li
      id={`result-ref-${number}`}
      className="evidence-record grid scroll-mt-24 grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-4 py-5"
    >
      <span className="ref-badge bg-foreground text-white">{number}</span>
      <div className="min-w-0">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          lang="en"
          className="break-words text-base font-bold leading-6 text-foreground underline decoration-border-subtle underline-offset-4 transition-colors hover:decoration-accent"
        >
          {item.title}
          <span className="sr-only"> 새 탭에서 PubMed 열림</span>
        </a>
        <p lang="en" className="mt-1.5 break-words text-[0.8125rem] leading-5 text-muted">
          {metadata.join(", ") || "서지정보 미표시"}
        </p>
      </div>

      <div className="col-start-2 flex flex-wrap gap-1.5">
        <span className="chip bg-accent-soft text-navy">
          {item.source_scope === "abstract_only" ? "초록 확인" : "제목만 확인"}
        </span>
        <span
          className={`chip ${
            item.sentence_role === "background_or_methods"
              ? "bg-warning/10 text-warning"
              : "chip-quiet"
          }`}
        >
          {item.source_scope === "title_only"
            ? "제목에서 추출, 문장 위치 미분류"
            : sentenceRoleLabel(item.sentence_role)}
        </span>
      </div>

      {item.key_finding_ko ? (
        <div className="inset-block inset-block-note col-start-2">
          <p className="text-[0.8125rem] font-bold text-navy">
            AI 자동 번역
          </p>
          <div className="mt-1.5 space-y-2 text-[0.9375rem] leading-6 text-foreground">
            {splitEvidenceSentences(item.key_finding_ko).map(
              (sentence, sentenceIndex) => (
                <p key={`${item.record_id}-detail-${sentenceIndex}`}>
                  {sentence}
                </p>
              ),
            )}
          </div>
        </div>
      ) : null}

      {plainLine ? (
        <div className="motion-enter inset-block inset-block-note col-start-2">
          <p className="text-[0.8125rem] font-bold text-navy">AI 한 줄 요약</p>
          <p className="mt-1.5 text-[0.9375rem] leading-6 text-foreground">{plainLine}</p>
        </div>
      ) : pendingLine ? (
        <div
          aria-hidden="true"
          className="inset-block inset-block-note col-start-2"
        >
          <p className="text-[0.8125rem] font-bold text-navy">
            AI 한 줄 요약 작성 중
          </p>
          <span className="loading-skeleton mt-2 block h-4 w-full rounded" />
          <span className="loading-skeleton mt-1.5 block h-4 w-4/5 rounded" />
        </div>
      ) : null}

      <blockquote className="inset-block inset-block-quiet col-start-2">
        <p className="text-[0.8125rem] font-bold text-muted">
          {item.source_scope === "title_only"
            ? `제목에서 추출, ${locator}`
            : `AI 자동 추출, ${locator}`}
        </p>
        <p lang="en" className="mt-1.5 break-words text-[0.9375rem] leading-6 text-foreground">
          {item.source_sentence || "가져올 원문 문장이 없습니다."}
        </p>
      </blockquote>

      {item.population || item.dose || item.outcome ? (
        <AnimatedDetails
          className="disclosure col-start-2"
          summaryClassName="disclosure-summary text-muted"
          bodyClassName="disclosure-body"
          summary={
            <>
              <span>문헌 추가 정보</span>
              <span aria-hidden="true" className="collapsible-chevron">
                ↓
              </span>
            </>
          }
        >
          <dl className="grid gap-3 p-4 text-[0.8125rem] leading-5">
            {item.population ? (
              <div>
                <dt className="font-bold text-foreground">연구 대상</dt>
                <dd lang="en" className="mt-1 break-words text-muted">
                  {item.population}
                </dd>
              </div>
            ) : null}
            {item.dose ? (
              <div>
                <dt className="font-bold text-foreground">초록에 적힌 용량</dt>
                <dd lang="en" className="mt-1 break-words text-muted">
                  {item.dose}
                </dd>
              </div>
            ) : null}
            {item.outcome ? (
              <div>
                <dt className="font-bold text-foreground">평가 항목</dt>
                <dd lang="en" className="mt-1 break-words text-muted">
                  {item.outcome}
                </dd>
              </div>
            ) : null}
          </dl>
        </AnimatedDetails>
      ) : null}
    </li>
  );
}

function focusSoon<T extends HTMLElement>(ref: RefObject<T | null>) {
  window.requestAnimationFrame(() => ref.current?.focus());
}

function SparkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="hero-chip-icon"
      fill="currentColor"
    >
      <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8l4.9-1.6Z" />
    </svg>
  );
}

export function PersonalizedSafetyQuery() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [activeExample, setActiveExample] = useState("");
  /**
   * 상황 라디오 5개와 조건 체크박스 5개는 접어 둔다.
   *
   * 첫 화면의 입력 경로는 문장 하나다. 열 개짜리 목록은 고칠 사람만 펼친다.
   * 예시를 누르거나 문장 해석이 끝나면 안쪽이 이미 채워진 상태이므로 그때
   * 함께 펼쳐, 무엇이 켜졌는지 보이게 한다.
   */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sentence, setSentence] = useState("");
  const [interpreting, setInterpreting] = useState(false);
  const [interpreted, setInterpreted] = useState<Interpreted | null>(null);
  const [consult, setConsult] = useState<ConsultText>(null);
  const [composing, setComposing] = useState(false);
  const [consultElapsedMs, setConsultElapsedMs] = useState(0);
  // 취소한 요청이나 이전 환자의 해설이 새 결과에 섞이지 않게 요청마다 번호를 매긴다.
  const composeSequenceRef = useRef(0);
  // 같은 조건을 다시 조회하면 방금 받은 해설을 다시 사지 않는다(같은 화면 안에서만).
  const consultCacheRef = useRef(new Map<string, NonNullable<ConsultText>>());
  const requestRef = useRef<AbortController | null>(null);
  const composeRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const firstSituationRef = useRef<HTMLInputElement | null>(null);

  useEffect(
    () => () => {
      requestRef.current?.abort();
      composeRef.current?.abort();
    },
    [],
  );

  // 조건을 하나 빼면 몇 건이 되는지 미리 재 둔다. 조건이 겹칠수록 남는 문헌이
  // 빠르게 줄어드는데, 어느 조건이 좁혔는지는 이 숫자가 말해 준다.
  // 조회 라우트는 외부 호출이 없어 여러 번 불러도 된다.
  const [widen, setWiden] = useState<{ axis: AxisId; count: number }[]>([]);
  const widenKey = result
    ? `${result.query_snapshot.situation}|${sortedAxes(result.query_snapshot.requested_axes)}`
    : "";
  useEffect(() => {
    const snapshot = result?.query_snapshot;
    if (!snapshot || snapshot.requested_axes.length < 2) {
      setWiden([]);
      return;
    }
    const controller = new AbortController();
    setWiden([]);
    Promise.all(
      snapshot.requested_axes.map(async (axis) => {
        const rest = snapshot.requested_axes.filter((item) => item !== axis);
        try {
          const res = await fetch("/api/personalized-safety", {
            method: "POST",
            headers: { "content-type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({ situation: snapshot.situation, axes: rest }),
          });
          const body = (await res.json()) as { evidence_total_after_filter?: number };
          const count = body?.evidence_total_after_filter ?? 0;
          return { axis, count };
        } catch {
          return null;
        }
      }),
    ).then((rows) => {
      if (controller.signal.aborted) return;
      const current = result?.evidence_total_after_filter ?? 0;
      setWiden(
        (rows.filter(Boolean) as { axis: AxisId; count: number }[])
          // 늘어나지 않는 조건은 제안할 이유가 없다.
          .filter((row) => row.count > current)
          .sort((a, b) => b.count - a.count),
      );
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widenKey]);

  // 한국어 번역이 없는 기록만 한 줄로 옮긴다. 핵심 근거는 이미 번역이 붙어
  // 있고, 확장 근거만 영어 원문 문장으로 남는다. 기록마다 따로 부른다.
  const [recordLines, setRecordLines] = useState<Record<string, string>>({});
  // 한 줄 요약이 오는 데 몇 초 걸린다. 자리를 잡아 둔다.
  const [recordLinesPending, setRecordLinesPending] = useState(false);
  const recordKey = result
    ? result.evidence.filter((item) => !item.key_finding_ko && !isRetractedPublication(item.publication_types)).map((item) => item.record_id).join("|")
    : "";
  useEffect(() => {
    if (!recordKey) {
      setRecordLines({});
      setRecordLinesPending(false);
      return;
    }
    const controller = new AbortController();
    const targets = (result?.evidence ?? []).filter((item) => !item.key_finding_ko && !isRetractedPublication(item.publication_types));
    setRecordLines({});
    setRecordLinesPending(true);
    runLimited(targets.slice(0, 12), 6, async (item) => {
        try {
          const res = await fetch("/api/consult/record", {
            method: "POST",
            headers: { "content-type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              title: item.title,
              year: item.year,
              publication_types: item.publication_types,
              source_sentence: item.source_sentence,
            }),
          });
          const body = (await res.json()) as { ok?: boolean; line?: string };
          if (body?.ok && body.line) return [item.record_id, body.line] as const;
        } catch {
          // 개별 실패는 그 카드만 요약 없이 둔다.
        }
        return null;
      }).then((pairs) => {
      if (controller.signal.aborted) return;
      setRecordLines(
        Object.fromEntries(pairs.filter(Boolean) as (readonly [string, string])[]),
      );
      setRecordLinesPending(false);
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordKey]);

  // 결과가 확정된 뒤에만 결과 해설을 만든다. 모델은 이미 고른 문헌만 읽으므로
  // 어떤 문헌이 뽑혔는지는 여기서 바뀌지 않는다. 실패하면 서버가 결정론 문단을
  // 그대로 돌려주고, 그것마저 없으면 해설 칸을 아예 띄우지 않는다.
  useEffect(() => {
    if (!result?.narrative?.length) {
      setConsult(null);
      setConsultElapsedMs(0);
      return;
    }
    composeRef.current?.abort();
    const controller = new AbortController();
    composeRef.current = controller;
    composeSequenceRef.current += 1;
    const sequence = composeSequenceRef.current;
    const live = () => !controller.signal.aborted && composeSequenceRef.current === sequence;
    setComposing(true);
    setConsultElapsedMs(0);
    // 이전 결과의 해설을 먼저 비운다. 서버가 보내는 문헌별 정리(interim)가 오면
    // 그것을 보여주고, AI 해설이 확정되면 바꿔 넣는다.
    setConsult(null);
    const body = {
      situation_label: result.situation_label,
      situation_id: result.query_snapshot.situation,
      patient_context: result.patient_context ?? "",
      condition_line: result.query_snapshot.requested_axes
        .map((axis) => axisById.get(axis)?.label ?? axis)
        .join(", "),
      narrative: result.narrative,
      // 해설은 초록에서 뽑은 문장을 읽고 써야 한다. 제목과 연도만 보내면
      // 모델이 볼 것이 건수뿐이라 "몇 편이 나왔습니다" 밖으로 못 나간다.
      evidence: result.evidence.filter((item) => !isRetractedPublication(item.publication_types)).map((item) => ({
        record_id: item.record_id,
        title: item.title,
        year: item.year,
        publication_types: item.publication_types,
        key_finding_ko: item.key_finding_ko,
        source_sentence: item.source_sentence,
        population: item.population,
        dose: item.dose,
        outcome: item.outcome,
      })),
    };
    const cacheKey = JSON.stringify(body);
    const cached = consultCacheRef.current.get(cacheKey);
    if (cached) {
      setConsult(cached);
      setComposing(false);
      composeRef.current = null;
      return () => controller.abort();
    }
    // 서버까지 못 갔을 때 보여줄 최소한의 문단. 서버가 답하면 그쪽 정리를 쓴다.
    const deterministic = result.evidence
      .filter(item => !isRetractedPublication(item.publication_types) && item.source_scope === "abstract_only")
      .slice(0, 3).map(item => ({
        text: item.key_finding_ko || item.source_sentence || item.key_finding,
        recordIds: [item.record_id],
      }));
    const fallback = (reason: string): NonNullable<ConsultText> => ({
      paragraphs: deterministic,
      source: "deterministic",
      reason,
      stage: "final",
    });
    let interim: ConsultParagraph[] = [];

    fetch("/api/consult/compose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: cacheKey,
    })
      .then(async (response) => {
        if (!response.ok) {
          if (live()) setConsult(fallback(response.status === 429 ? "rate_limited" : "http_error"));
          return;
        }
        await readConsultResponse(response, (event) => {
          if (!live()) return;
          if (event.type === "interim") {
            interim = event.paragraphs;
            setConsult({ paragraphs: event.paragraphs, source: "deterministic", reason: "generating", stage: "interim" });
            return;
          }
          if (event.type === "heartbeat") {
            setConsultElapsedMs(event.elapsedMs);
            return;
          }
          const hasParagraphs = event.paragraphs?.length > 0;
          const final: NonNullable<ConsultText> = {
            paragraphs: hasParagraphs ? event.paragraphs : interim.length ? interim : deterministic,
            source: hasParagraphs ? event.source : "deterministic",
            reason: hasParagraphs ? event.reason : "empty_response",
            stage: "final",
            interim: interim.length ? interim : undefined,
            elapsedMs: event.elapsedMs,
          };
          if (final.source === "ai_written") {
            if (consultCacheRef.current.size >= 20) {
              consultCacheRef.current.delete(consultCacheRef.current.keys().next().value as string);
            }
            consultCacheRef.current.set(cacheKey, final);
          }
          setConsult(final);
        });
      })
      .catch(() => {
        if (live()) setConsult(interim.length ? { paragraphs: interim, source: "deterministic", reason: "network", stage: "final" } : fallback("network"));
      })
      .finally(() => {
        if (composeRef.current === controller) {
          composeRef.current = null;
          setComposing(false);
        }
      });
    return () => controller.abort();
  }, [result]);

  const run = useCallback(
    async (
      values: FormState,
      extra: { expanded?: boolean; offset?: number } = {},
      options: { scroll?: boolean; patientContext?: string } = {},
    ) => {
      if (!values.situation) {
        setError("먼저 임상 상황을 하나 선택하세요.");
        focusSoon(firstSituationRef);
        return;
      }

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setPending(true);
      setError("");

      try {
        const response = await fetch("/api/personalized-safety", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...values, ...extra }),
          signal: controller.signal,
        });
        const body = (await response.json()) as ApiResult;
        if (!response.ok) {
          setError(body.error ?? "문헌을 찾지 못했습니다. 다시 시도하세요.");
          focusSoon(errorRef);
          return;
        }

        setResult({ ...body, patient_context: options.patientContext ?? "" });
        window.requestAnimationFrame(() => {
          if (options.scroll !== false) {
            const reduceMotion = window.matchMedia(
              "(prefers-reduced-motion: reduce)",
            ).matches;
            resultRef.current?.scrollIntoView({
              behavior: reduceMotion ? "auto" : "smooth",
              block: "start",
            });
          }
          window.requestAnimationFrame(() =>
            resultHeadingRef.current?.focus({ preventScroll: true }),
          );
        });
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError("연결이 끊겨 문헌을 찾지 못했습니다. 다시 시도하세요.");
        focusSoon(errorRef);
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setPending(false);
        }
      }
    },
    [],
  );

  function selectSituation(situation: SituationId) {
    setForm((previous) => ({
      situation,
      axes: previous.axes.filter((axis) => axisCoverage[situation][axis] !== null),
    }));
    setActiveExample("");
    setError("");
  }

  function toggleAxis(axis: AxisId) {
    setForm((previous) => ({
      ...previous,
      axes: previous.axes.includes(axis)
        ? previous.axes.filter((item) => item !== axis)
        : [...previous.axes, axis],
    }));
    setActiveExample("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(form, {}, { patientContext: sentence.trim() });
  }

  // 예시는 문장칸과 조건을 함께 채운다. 조건만 켜면 문장칸이 무엇을 받는
  // 칸인지 예시로는 알 수 없다. 문장까지 채워 두면 그대로 눌러 보고 고쳐
  // 쓰는 것도 된다.
  function runExample(example: (typeof publicInputExamples)[number]) {
    setSentence(example.sentence);
    // 앞선 AI 결과가 남아 있으면 지금 문장과 다른 조건을 설명하게 된다.
    setInterpreted(null);
    setForm(example.input);
    setActiveExample(example.id);
    setPickerOpen(true);
    setError("");
    void run(example.input, {}, { patientContext: example.sentence });
  }

  // 문장 → 조건. 여기서 나온 값은 화면의 라디오와 체크박스를 켜는 데만 쓰고,
  // 근거 조회는 그다음부터 지금까지와 똑같은 결정론 경로로 돈다. 사용자가 켜진
  // 조건을 직접 고칠 수 있으므로 모델이 틀려도 막다른 길이 아니다.
  async function interpretSentence() {
    const text = sentence.trim();
    if (!text) {
      setError("찾으려는 상황을 한두 문장으로 입력하세요.");
      return;
    }
    setInterpreting(true);
    setError("");
    try {
      const response = await fetch("/api/consult/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = (await response.json()) as Interpreted;
      if (!response.ok || !body.situation) {
        setInterpreted(null);
        setError(
          body.error ??
            "문장에서 다섯 상황 중 어느 것인지 찾지 못했습니다. 아래에서 직접 선택하세요.",
        );
        setPickerOpen(true);
        focusSoon(firstSituationRef);
        return;
      }
      const next: FormState = {
        situation: body.situation,
        axes: body.applied_axes.map((item) => item.axis),
      };
      setInterpreted(body);
      setForm(next);
      setActiveExample("");
      setPickerOpen(true);
      void run(next, {}, { patientContext: text });
    } catch {
      setInterpreted(null);
      setError("문장을 해석하지 못했습니다. 아래에서 직접 선택할 수 있습니다.");
      setPickerOpen(true);
    } finally {
      setInterpreting(false);
    }
  }

  function runResultPage(extra: { expanded?: boolean; offset?: number }) {
    if (!result) return;
    void run(
      {
        situation: result.query_snapshot.situation,
        axes: result.query_snapshot.requested_axes,
      },
      extra,
      { scroll: false, patientContext: result.patient_context },
    );
  }

  function reset() {
    requestRef.current?.abort();
    requestRef.current = null;
    composeRef.current?.abort();
    composeRef.current = null;
    setForm(emptyForm);
    setResult(null);
    setPending(false);
    setError("");
    setActiveExample("");
    setSentence("");
    setInterpreted(null);
    setConsult(null);
    setConsultElapsedMs(0);
    setPickerOpen(false);
  }

  const staleResult = result ? !isSameQuery(form, result) : false;
  const selectedSituation = situations.find((item) => item.id === form.situation);
  const findingSentences = result
    ? flattenTranslatedFindings(result.evidence)
    : [];
  const interpretedSituation = interpreted
    ? situations.find((item) => item.id === interpreted.situation)
    : undefined;

  return (
    <div>
      {/* 검색 띠. 공공데이터포털처럼 제목, 문장 입력칸, 예시 질문을 한 띠에 둔다. */}
      <section
        id="explorer"
        aria-labelledby="page-title"
        className="hero scroll-mt-16 px-4 sm:px-6"
      >
        <div className="hero-inner">
          <p className="hero-eyebrow">연세대학교 임상약학연구실 졸업논문 연구</p>
          <h1 id="page-title" className="hero-title">
            임상 상황별 보충제 안전성 근거 조회
          </h1>
          <p className="hero-lead">
            수술 전후, 신질환, 임신, 간질환, 항응고 치료 상황에서 보고된 PubMed 문헌을 조회합니다.
            겪고 있는 상황을 문장으로 적으면 AI가 다섯 상황과 조회 조건으로 정리합니다.
          </p>

          <div className="hero-search">
            <textarea
              value={sentence}
              onChange={(event) => setSentence(event.target.value)}
              rows={2}
              maxLength={600}
              placeholder="예: 임신 중인데 철분제 용량을 다룬 연구가 있는지 알고 싶습니다"
              aria-label="찾으려는 상황"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void interpretSentence();
                }
              }}
            />
            <div className="hero-search-actions">
              <p className="hero-search-hint">
                AI는 문장을 상황과 조건으로 옮기기만 합니다. 조회는 초록에 그 항목이 나오는지만 확인합니다.
              </p>
              <button
                type="button"
                onClick={() => void interpretSentence()}
                disabled={interpreting || pending || !sentence.trim()}
                className="hero-submit"
              >
                {interpreting ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    />
                    조건 해석 중
                  </>
                ) : (
                  <>
                    문장으로 조회
                    <span aria-hidden="true" className="hero-submit-arrow">
                      ↑
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 예시 질문. 빈 칸만 있으면 무엇을 적어야 할지 모르므로 문장칸 바로
              아래 붙인다. 누르면 문장까지 채우고 바로 조회한다. */}
          <div className="hero-chips" aria-label="예시 질문">
            {publicInputExamples.map((example) => (
              <button
                key={example.id}
                type="button"
                disabled={pending}
                aria-pressed={activeExample === example.id}
                title={example.title}
                onClick={() => runExample(example)}
                className="hero-chip"
              >
                <SparkIcon />
                <span>“{example.sentence}”</span>
              </button>
            ))}
          </div>

          {interpreted ? (
            <div className="hero-note motion-enter">
              <strong>AI 해석 결과</strong>
              <p>
                {interpretedSituation?.label ?? "상황 미확인"}
                {interpreted.applied_axes.length
                  ? `, 조건: ${interpreted.applied_axes
                      .map((item) => axisById.get(item.axis)?.label ?? item.axis)
                      .join(", ")}`
                  : ", 조건 없음"}
              </p>
              {interpreted.notice ? (
                <p className="mt-1 text-[0.875rem] text-white/80">{interpreted.notice}</p>
              ) : null}
              {interpreted.unavailable_axes.length ? (
                <p className="mt-1 text-[0.875rem] text-white/80">
                  {interpreted.unavailable_axes
                    .map((item) => axisById.get(item.axis)?.label ?? item.axis)
                    .join(", ")}
                  은(는) 이 상황에 규칙이 없어 조건에서 제외했습니다.
                </p>
              ) : null}
              {interpreted.unmatched ? (
                <p className="mt-1 text-[0.875rem] text-white/80">
                  조건으로 옮기지 못한 표현: {interpreted.unmatched}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <div className="page-shell page-stack px-4 py-8 sm:px-6 sm:py-10">
        <section className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[1.125rem] font-bold leading-snug text-foreground">
                조회 조건
              </h2>
              <p className="mt-1 text-[0.9375rem] leading-6 text-muted">
                문장으로 조회하면 이 칸이 자동으로 채워집니다. 상황과 조건은 직접 고칠 수 있습니다.
              </p>
            </div>
            <InfoTip label="조회 방식">
              이 화면은 개인 상태를 판정하지 않습니다. 연구 질문 하나를 고르고, 그
              질문에 걸린 문헌 가운데 선택한 조건이 초록에 나온 것만 남깁니다.
            </InfoTip>
          </div>

          {/* 라디오와 체크박스 열 개는 접어 둔다. 문장으로 조회하면 이 안이 이미
              채워져 있고, 고칠 사람만 펼친다. */}
          <div className="mt-4 border-t border-border-subtle pt-4">
            <button
              type="button"
              aria-expanded={pickerOpen}
              aria-controls="evidence-query-form"
              onClick={() => setPickerOpen((open) => !open)}
              className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
            >
              <span className="text-base font-bold text-foreground">직접 선택</span>
              <span className="flex items-center gap-2 text-[0.8125rem] leading-5 text-muted">
                {selectedSituation
                  ? `${selectedSituation.short}, 조건 ${form.axes.length}개`
                  : "상황과 조건 직접 선택"}
                <span
                  aria-hidden="true"
                  className={`collapsible-chevron ${pickerOpen ? "rotate-180" : ""}`}
                >
                  ↓
                </span>
              </span>
            </button>
          </div>

          {pickerOpen ? (

          <form
            id="evidence-query-form"
            onSubmit={submit}
            className="mt-4 scroll-mt-20 border-t border-border-subtle pt-4"
          >
            {/* 두 목록은 같은 줄 수, 같은 줄 높이로 맞춰 좌우가 한 줄씩 마주 보게 한다. */}
            <div className="grid gap-4 lg:grid-cols-2">
              <fieldset className="min-w-0">
                <legend className="text-base font-bold text-foreground">
                  1. 임상 상황
                  <span className="ml-2 text-[0.8125rem] font-bold text-danger">
                    필수
                  </span>
                </legend>
                <p className="mt-2 text-[0.9375rem] leading-6 text-muted lg:min-h-12">
                  다섯 상황 가운데 하나를 선택합니다. 선택한 상황의 핵심 문헌부터 표시합니다.
                </p>
                <div className="mt-3 grid gap-2">
                  {situations.map((situation, index) => (
                    <label key={situation.id} className="choice-row">
                      <input
                        ref={index === 0 ? firstSituationRef : undefined}
                        type="radio"
                        name="situation"
                        value={situation.id}
                        checked={form.situation === situation.id}
                        onChange={() => selectSituation(situation.id)}
                      />
                      <span className="min-w-0">
                        <span className="block text-[0.9375rem] font-bold leading-5 text-foreground">
                          {situation.label}
                        </span>
                        <span className="mt-0.5 block text-[0.8125rem] leading-[1.125rem] text-muted">
                          핵심 문헌 {coreCoverage[situation.id]}건
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="min-w-0">
                <legend className="text-base font-bold text-foreground">
                  2. 초록 언급 조건
                  <span className="ml-2 text-[0.8125rem] font-bold text-muted">
                    선택
                  </span>
                </legend>
                <p className="mt-2 text-[0.9375rem] leading-6 text-muted lg:min-h-12">
                  선택한 조건이 초록에 나온 문헌만 남깁니다. 연령, 약 이름, 용량 값 자체를 대조하지 않습니다.
                </p>
                <div className="mt-3 grid gap-2">
                  {axes.map((axis) => {
                    const coverage = form.situation
                      ? axisCoverage[form.situation][axis.id]
                      : undefined;
                    const unavailable = coverage === null;
                    return (
                      <label key={axis.id} className="choice-row">
                        <input
                          type="checkbox"
                          name="evidence-axis"
                          value={axis.id}
                          checked={form.axes.includes(axis.id)}
                          disabled={!form.situation || unavailable}
                          onChange={() => toggleAxis(axis.id)}
                        />
                        <span className="min-w-0">
                          <span className="block text-[0.9375rem] font-bold leading-5">
                            {axis.label}
                          </span>
                          {/* 좁은 화면에서 잘리더라도 건수가 먼저 남도록 순서를 둔다. */}
                          <span className="mt-0.5 line-clamp-1 text-[0.8125rem] leading-[1.125rem] text-muted">
                            {!form.situation
                              ? "상황 선택 후 사용"
                              : unavailable
                                ? "이 상황에는 해당 규칙 없음"
                                : `${coverage}건, ${axis.filterHint}`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className="sticky bottom-3 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-border-subtle bg-white/95 p-3 shadow-[var(--shadow-float)] backdrop-blur sm:static sm:mt-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
              <button
                type="submit"
                disabled={pending}
                className={`${buttonPrimary} flex-1 disabled:cursor-wait disabled:opacity-60 sm:flex-none`}
              >
                {pending ? "조회 중" : "문헌 조회"}
              </button>
              <button type="button" onClick={reset} className={buttonQuiet}>
                초기화
              </button>
              {selectedSituation ? (
                <span className="text-[0.8125rem] text-muted">
                  {selectedSituation.short}, 조건 {form.axes.length}개
                </span>
              ) : null}
            </div>
          </form>
          ) : null}
        </section>

        <div ref={resultRef} className="page-stack scroll-mt-20">
          <p role="status" aria-live="polite" className="sr-only">
            {pending
              ? "문헌을 찾는 중입니다."
              : error
                ? error
                : result
                  ? resultStatusMessage(result)
                  : ""}
          </p>

          {error ? (
            <div
              ref={errorRef}
              tabIndex={-1}
              aria-label="문헌 조회 오류"
              className="card card-danger text-[0.9375rem] font-bold leading-6"
            >
              {error}
            </div>
          ) : null}

          {pending && !result ? <ResultSkeleton /> : null}

          {!pending && !result && !error ? (
            <div className="card card-dashed text-center">
              <p className="text-base font-bold text-foreground">
                아직 조회한 문헌이 없습니다.
              </p>
              <p className="mx-auto mt-2 max-w-[36rem] text-[0.9375rem] leading-6 text-muted">
                위 예시 질문을 선택하거나, 문장을 입력하고 조회를 누르면 이 자리에 결과를 표시합니다.
              </p>
            </div>
          ) : null}

          {result ? (
            <article
              aria-busy={pending}
              className={`card card-flush ${pending ? "opacity-60" : "motion-enter"}`}
            >
              <header className="card-section flex flex-col gap-5">
                {pending ? (
                  <p className="inset-block inset-block-note text-[0.9375rem] font-bold text-navy">
                    새 조건으로 다시 조회하는 중입니다. 완료할 때까지 현재 결과를 그대로 둡니다.
                  </p>
                ) : null}
                {staleResult ? (
                  <p className="inset-block border border-warning/30 bg-warning/10 text-[0.9375rem] leading-6 text-foreground">
                    조건을 바꿨습니다. 아래는 바꾸기 전 조건으로 조회한 결과입니다.
                  </p>
                ) : null}
                {result.expanded ? (
                  <p className="inset-block border border-warning/30 bg-warning/10 text-[0.9375rem] leading-6 text-foreground">
                    {result.applied_axes.length
                      ? `핵심 목록 밖의 문헌 후보 목록에도 같은 조건을 걸었습니다. 이 상황의 문헌 ${result.extended_pool_total.toLocaleString("ko-KR")}건 가운데 ${result.extended_total.toLocaleString("ko-KR")}건이 남았습니다. `
                      : "이 상황의 후보 문헌 목록입니다. "}
                    아직 한국어로 옮기지 않아 영어 문장 그대로 표시합니다.
                  </p>
                ) : null}

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip bg-navy text-white">
                      {result.situation_label}
                    </span>
                    <span className="text-[0.8125rem] font-bold text-muted">
                      {resultCountLabel(result)}
                    </span>
                  </div>
                  <h2
                    ref={resultHeadingRef}
                    tabIndex={-1}
                    className="mt-3 text-xl font-bold leading-8 text-foreground focus:outline-none sm:text-2xl"
                  >
                    {resultHeading(result)}
                  </h2>
                  <p className="mt-1.5 text-[0.9375rem] leading-6 text-muted">
                    이때 고른 조건: {result.situation_label}
                    {result.query_snapshot.requested_axes.length
                      ? `, ${result.query_snapshot.requested_axes
                          .map((axis) => axisById.get(axis)?.label ?? axis)
                          .join(", ")}`
                      : ", 조건 없음"}
                  </p>
                </div>

                {/* 결과 해설. 문단은 위에 연결된 문헌만 읽고 쓴 것이고, 어떤 문헌이
                    뽑히는지는 이 칸과 무관하다. 서버 심판이 지시 표현이나 근거에 없는
                    숫자를 잡으면 시스템이 계산한 문단으로 되돌아온다. */}
                {composing && !consult ? (
                  <div
                    aria-hidden="true"
                    className="inset-block inset-block-note flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
                      <span className="text-[0.9375rem] font-bold text-muted">
                        문헌별 정리를 불러오는 중
                      </span>
                    </div>
                    <span className="loading-skeleton block h-4 w-full rounded" />
                    <span className="loading-skeleton block h-4 w-11/12 rounded" />
                    <span className="loading-skeleton block h-4 w-3/4 rounded" />
                  </div>
                ) : null}

                {consult ? (
                  <section
                    aria-labelledby="consult-title"
                    className="inset-block inset-block-note"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="chip inline-flex bg-navy text-white">
                        {consult.stage === "interim" ? "문헌별 정리" : consult.source === "ai_written" ? "AI 작성" : "자동 생성"}
                      </span>
                      <h3
                        id="consult-title"
                        className="text-base font-bold text-foreground"
                      >
                        결과 해설
                      </h3>
                      <InfoTip label="결과 해설">
                        아래에 붙은 문헌만 읽고 쓴 글입니다. 어떤 문헌이 뽑히는지는 이
                        글과 상관없이 규칙 파일이 정합니다. AI가 쓴 문장에 복용 지시나
                        근거에 없는 숫자가 있으면 서버가 걸러 내고, 시스템이 계산한
                        문장을 대신 표시합니다.
                      </InfoTip>
                      {consult.stage === "interim" ? (
                        <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-muted">
                          <span
                            aria-hidden="true"
                            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/25 border-t-accent"
                          />
                          AI 해설 쓰는 중
                          {consultElapsedMs > 0 ? ` (${elapsedLabel(consultElapsedMs)})` : ""}
                        </span>
                      ) : null}
                    </div>
                    {consult.stage === "interim" ? (
                      <p className="mt-2 text-[0.8125rem] leading-5 text-muted">
                        AI가 문헌을 읽고 해설을 쓰는 동안, 서버 원자료로 정리한 문헌별 대상과
                        양과 결과를 먼저 보여드립니다. 해설이 오면 이 자리에 바꿔 넣습니다.
                      </p>
                    ) : consult.source === "deterministic" &&
                      consultFallbackReason(consult.reason) ? (
                      <p className="mt-2 text-[0.8125rem] leading-5 text-muted">
                        {consultFallbackReason(consult.reason)}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-col gap-3 text-[0.9375rem] leading-6 text-foreground">
                      {consult.paragraphs.map((paragraph, index) => {
                        // 인용한 기록을 이번 목록의 번호로 바꿔 보여준다. 목록에 없는
                        // 기록은 심판이 이미 걸러 내므로 여기서는 나올 수 없다.
                        const numbers = paragraph.recordIds
                          .map((id) =>
                            result.evidence.findIndex((item) => item.record_id === id),
                          )
                          .filter((position) => position >= 0)
                          .map((position) =>
                            result.expanded
                              ? result.expanded_offset + position + 1
                              : position + 1,
                          )
                          .sort((a, b) => a - b);
                        return (
                          <div key={`consult-${index}`}>
                            <p>{paragraph.text}</p>
                            {numbers.length ? (
                              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-muted">
                                <span>근거</span>
                                {numbers.map((number) => (
                                  <a
                                    key={number}
                                    href={`#result-ref-${number}`}
                                    className="ref-badge bg-accent/12 text-navy no-underline"
                                  >
                                    {number}
                                  </a>
                                ))}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    {consult.source === "ai_written" && consult.interim?.length ? (
                      <details className="mt-3 text-[0.875rem] leading-6 text-muted">
                        <summary className="min-h-11 cursor-pointer list-none font-semibold text-foreground">
                          서버가 정리한 문헌별 대상, 양, 결과 보기
                        </summary>
                        <div className="mt-2 flex flex-col gap-2">
                          {consult.interim.map((paragraph, index) => (
                            <p key={`interim-${index}`}>{paragraph.text}</p>
                          ))}
                        </div>
                      </details>
                    ) : null}
                    <p className="mt-2 text-[0.8125rem] leading-5 text-muted">
                      복용 시작과 중단, 용량은 여기서 판단하지 않습니다.
                    </p>
                  </section>
                ) : null}

                <dl className="grid gap-2 sm:grid-cols-3">
                  <SummaryTile
                    label={result.expanded ? "이 페이지 표시 건수" : "표시 건수"}
                    value={result.evidence_summary.displayed_records}
                    unit="건"
                    note={
                      result.extended_shown > 0
                        ? `핵심 ${result.core_shown} + 넓혀 찾은 ${result.extended_shown}`
                        : undefined
                    }
                  />
                  <SummaryTile
                    label="겹치는 제목 뺀 문헌"
                    value={result.evidence_summary.unique_titles}
                    unit="편"
                    tip={
                      <InfoTip label="겹치는 제목 뺀 문헌">
                        제목이 같으면 한 편으로 셌습니다. 영문 소문자와 띄어쓰기를 맞춰
                        비교하므로, 위에 적은 건수보다 적게 나올 수 있습니다.
                      </InfoTip>
                    }
                  />
                  <SummaryTile
                    label="초록까지 확인한 문헌"
                    value={result.evidence_summary.source_scope.abstract_only}
                    unit="건"
                    note={`제목만 확인 ${result.evidence_summary.source_scope.title_only}건`}
                  />
                </dl>

                {result.filter_mode === "metadata_axis_presence" &&
                result.filter_trace.length > 1 ? (
                  <div>
                    <p className="text-[0.8125rem] font-bold text-foreground">
                      조건별 남은 건수
                    </p>
                    <ol className="mt-2 flex flex-wrap items-center gap-2">
                      {result.filter_trace.map((step, index) => (
                        <li key={step.axis} className="flex items-center gap-2">
                          {index ? (
                            <span aria-hidden="true" className="text-[0.8125rem] text-muted">
                              ›
                            </span>
                          ) : null}
                          <span className="chip chip-quiet">
                            {step.label} {step.count}건
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                <div className="inset-block inset-block-note text-[0.9375rem] leading-6 text-muted">
                  <p className="font-bold text-foreground">
                    이 화면의 표시 범위
                  </p>
                  <p className="mt-1">{resultBasisCopy(result)}</p>
                  <p className="mt-2 text-[0.8125rem] leading-5">
                    AI가 초록에서 뽑은 문장 {result.evidence_summary.ai_extracted_sentences}건, 한국어로 옮긴 문장{" "}
                    {result.evidence_summary.ai_translated_sentences}개
                    {result.evidence_summary.title_derived_records
                      ? `, 제목에서 가져온 것 ${result.evidence_summary.title_derived_records}건`
                      : ""}
                  </p>
                </div>

                {widen.length ? (
                  <div className="inset-block inset-block-quiet">
                    <p className="text-[0.8125rem] font-bold text-foreground">조건 하나를 뺄 때의 건수</p>
                    <p className="mt-1 text-[0.9375rem] leading-6 text-muted">
                      조건을 여러 개 걸수록 남는 문헌이 빠르게 줄어듭니다. 조건을 하나씩
                      뺐을 때 몇 건이 되는지 미리 세었습니다. 맨 위에 적힌 핵심{" "}
                      {result.core_shown}건과 같은 방식으로 센 숫자이고, 화면에는
                      여기에 넓혀 찾은 문헌을 더해 표시합니다.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {widen.map((row) => (
                        <button
                          key={row.axis}
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            const next: FormState = {
                              situation: result.query_snapshot.situation,
                              axes: result.query_snapshot.requested_axes.filter(
                                (item) => item !== row.axis,
                              ),
                            };
                            setForm(next);
                            void run(next, {}, { patientContext: result.patient_context });
                          }}
                          className={`${buttonQuiet} min-h-10 px-3 text-[0.8125rem]`}
                        >
                          {axisById.get(row.axis)?.label ?? row.axis} 제외 시 핵심 {row.count}건
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {!result.expanded && findingSentences.length ? (
                  <section aria-labelledby="evidence-findings-title">
                    <div className="flex items-center gap-2">
                      <h3
                        id="evidence-findings-title"
                        className="text-base font-bold text-foreground"
                      >
                        AI 추출 결과 문장
                      </h3>
                      <InfoTip label="AI 자동 추출 문장">
                        핵심 문헌의 결과 문장과 한국어 번역은 AI가 원문 초록에 대조했습니다.
                        사람의 문헌 검토나 임상 검증을 거친 문장이라는 뜻은 아닙니다.
                      </InfoTip>
                    </div>
                    <p className="mt-1.5 text-[0.9375rem] leading-6 text-muted">
                      문장마다 출처 문헌 번호를 붙였습니다. 번호를 누르면 그 문헌으로 이동합니다.
                    </p>
                    <ol className="inset-block-note mt-3 rounded-[var(--radius-card)] px-4">
                      {findingSentences
                        .slice(0, SUMMARY_SENTENCE_LIMIT)
                        .map((finding) => (
                          <EvidenceFinding
                            key={`${finding.item.record_id}-summary-${finding.sentenceIndex}`}
                            item={finding.item}
                            number={finding.paperNumber}
                            sentence={finding.sentence}
                            sentenceIndex={finding.sentenceIndex}
                          />
                        ))}
                    </ol>
                    {findingSentences.length > SUMMARY_SENTENCE_LIMIT ? (
                      <AnimatedDetails
                        className="disclosure mt-2"
                        summaryClassName="disclosure-summary text-navy"
                        bodyClassName="disclosure-body px-4"
                        summary={
                          <>
                            <span>
                              나머지 {findingSentences.length - SUMMARY_SENTENCE_LIMIT}개 자동 추출 문장 보기
                            </span>
                            <span aria-hidden="true" className="collapsible-chevron">
                              ↓
                            </span>
                          </>
                        }
                      >
                        <ol>
                          {findingSentences
                            .slice(SUMMARY_SENTENCE_LIMIT)
                            .map((finding) => (
                              <EvidenceFinding
                                key={`${finding.item.record_id}-remaining-${finding.sentenceIndex}`}
                                item={finding.item}
                                number={finding.paperNumber}
                                sentence={finding.sentence}
                                sentenceIndex={finding.sentenceIndex}
                              />
                            ))}
                        </ol>
                      </AnimatedDetails>
                    ) : null}
                  </section>
                ) : null}

                {result.evidence.length ? (
                  <nav aria-label="결과 안에서 이동" className="flex flex-wrap gap-2">
                    <a href="#evidence-list" className={`${buttonPrimary} no-underline`}>
                      문헌 목록으로 이동
                    </a>
                    <a
                      href="#evidence-query-form"
                      className={`${buttonQuiet} no-underline`}
                    >
                      조건 다시 선택
                    </a>
                  </nav>
                ) : null}

                <AnimatedDetails
                  className="disclosure"
                  summaryClassName="disclosure-summary text-foreground"
                  bodyClassName="disclosure-body p-4"
                  summary={
                    <>
                      <span>이 상황의 연구 질문 보기</span>
                      <span aria-hidden="true" className="collapsible-chevron">
                        ↓
                      </span>
                    </>
                  }
                >
                  <p className="text-[0.9375rem] leading-6 text-muted">
                    <span className="font-bold text-foreground">연구 질문</span>
                    <br />
                    {result.research_question}
                  </p>
                  {result.checks.length ? (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {result.checks.map((check) => (
                        <li key={check} className="chip chip-quiet">
                          {check}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </AnimatedDetails>

                {result.unavailable_axes.length ? (
                  <p className="inset-block border border-warning/30 bg-warning/10 text-[0.9375rem] leading-6 text-foreground">
                    이 상황에는 {result.unavailable_axes
                      .map((item) => axisById.get(item.axis)?.label ?? item.axis)
                      .join(", ")} 규칙이 없어 해당 조건을 적용하지 못했습니다.
                  </p>
                ) : null}
              </header>

              {result.evidence.length ? (
                <ol
                  id="evidence-list"
                  className="card-section scroll-mt-20 divide-y divide-border-subtle"
                >
                  {result.evidence.map((item, index) => {
                    const number = result.expanded
                      ? result.expanded_offset + index + 1
                      : index + 1;
                    return (
                      <EvidenceRecord
                        key={item.record_id}
                        item={item}
                        number={number}
                        plainLine={recordLines[item.record_id]}
                        pendingLine={
                          recordLinesPending && !item.key_finding_ko
                        }
                      />
                    );
                  })}
                </ol>
              ) : (
                <div className="card-section">
                  <p className="text-[0.9375rem] leading-6 text-muted">
                    {result.expanded
                      ? "선택한 조건을 한 편에서 모두 언급한 문헌이 넓힌 목록에도 없습니다."
                      : result.filter_mode === "metadata_axis_presence"
                        ? "선택한 조건을 한 편에서 모두 언급한 핵심 문헌이 없습니다."
                        : "이 상황에는 표시할 핵심 문헌이 없습니다."}
                  </p>
                  {result.filter_mode === "metadata_axis_presence" &&
                  result.query_snapshot.requested_axes.length ? (
                    <button
                      type="button"
                      onClick={() => {
                        const next = {
                          situation: result.query_snapshot.situation,
                          axes: result.query_snapshot.requested_axes.slice(0, -1),
                        };
                        setForm(next);
                        void run(next, {}, { patientContext: result.patient_context });
                      }}
                      disabled={pending}
                      className={`${buttonQuiet} mt-4 border-accent/40 text-navy`}
                    >
                      마지막 조건 하나 제외
                    </button>
                  ) : null}
                </div>
              )}

              {result.extended_total > result.evidence.length || result.expanded ? (
                <div className="card-section flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {result.expanded && result.expanded_offset > 0 ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          runResultPage({
                            expanded: true,
                            offset: Math.max(
                              0,
                              result.expanded_offset - result.expanded_page_size,
                            ),
                          })
                        }
                        className={buttonQuiet}
                      >
                        이전 {result.expanded_page_size}건
                      </button>
                    ) : null}
                    {result.expanded_offset + result.evidence.length < result.extended_total ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          runResultPage({
                            expanded: true,
                            offset: result.expanded
                              ? result.expanded_offset + result.expanded_page_size
                              : 0,
                          })
                        }
                        className={buttonPrimary}
                      >
                        {result.expanded
                          ? `다음 ${result.expanded_page_size}건`
                          : result.applied_axes.length
                            ? `같은 조건으로 ${result.extended_match_total.toLocaleString("ko-KR")}건까지 넓혀 보기`
                            : `이 상황의 문헌 ${result.extended_total.toLocaleString("ko-KR")}건 모두 보기`}
                      </button>
                    ) : null}
                    {result.expanded ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => runResultPage({})}
                        className={buttonQuiet}
                      >
                        핵심 문헌으로 돌아가기
                      </button>
                    ) : null}
                  </div>
                  <p className="text-[0.8125rem] leading-5 text-muted">
                    {result.extended_note}
                  </p>
                </div>
              ) : null}

              <footer className="card-section rounded-b-[var(--radius-card)] bg-surface-elevated text-[0.8125rem] leading-5 text-muted">
                {result.disclaimer || evidenceOnlyDisclaimer}
              </footer>
            </article>
          ) : null}
        </div>
      </div>
    </div>
  );
}
