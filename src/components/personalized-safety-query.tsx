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

/** 상담문. AI 가 쓴 것과 시스템이 계산한 것을 화면에서 구분해 표시한다.
 *  문단마다 근거로 삼은 기록 번호를 들고 있어 출처를 그 자리에서 보여준다. */
type ConsultParagraph = { text: string; recordIds: string[] };
type ConsultText = {
  paragraphs: ConsultParagraph[];
  source: "ai_written" | "deterministic";
  reason?: string;
} | null;

/**
 * 상담문이 결정론 문단으로 떨어진 까닭을 사람 말로 옮긴다.
 *
 * 배지만 "자동 생성"으로 바뀌면 두 상황이 한 모양이 된다 — 이 서버에 애초에
 * 작성 기능이 없는 것과, 이번 호출이 실패한 것. 둘은 사용자가 할 일이 다르다
 * (앞은 원래 그런 화면이고, 뒤는 다시 조회하면 붙는다).
 */
function consultFallbackReason(reason?: string) {
  if (!reason) return "";
  if (reason === "no_key")
    return "이 서버에는 상담문 작성 기능이 켜져 있지 않아, 시스템이 계산한 문장을 그대로 보여드립니다.";
  if (reason === "no_evidence")
    return "연결된 문헌이 없어 시스템이 계산한 문장을 보여드립니다.";
  if (reason === "refereed_out")
    return "AI 가 쓴 문장이 검토 규칙에 걸려 버렸습니다. 시스템이 계산한 문장을 대신 보여드립니다.";
  if (reason === "timeout")
    return "AI 응답이 제때 오지 않아 시스템이 계산한 문장을 보여드립니다. 다시 조회하면 붙을 수 있어요.";
  return "AI 문장을 받지 못해 시스템이 계산한 문장을 보여드립니다. 다시 조회하면 붙을 수 있어요.";
}

/** 카드 안에서 반복되는 버튼 모양. 높이와 모서리를 한곳에서 정한다. */
const buttonBase =
  "inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const buttonPrimary = `${buttonBase} bg-accent text-white hover:bg-accent-strong`;
const buttonQuiet = `${buttonBase} border border-border-subtle bg-surface text-foreground hover:border-accent/40`;

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
 * 예전 문구는 도구가 자기 내부 이름을 그대로 읽었다 — 표현·필터·축·기록·
 * metadata_axis_presence. 정확하긴 해도 사람에게 하는 말이 아니라, 읽는 쪽이
 * 매번 자기 말로 옮겨야 했다. 숫자는 그대로 두고 부르는 이름만 입으로 하는 말로
 * 바꾼다. 조건은 "표현 필터"가 아니라 "고른 이야기"이고, 넓힌 목록은 "확장 근거"가
 * 아니라 "넓혀 찾은 문헌"이다.
 */
function resultCountLabel(result: ApiResult) {
  if (result.expanded) {
    const first = result.evidence.length ? result.expanded_offset + 1 : 0;
    const last = result.expanded_offset + result.evidence.length;
    const scope = result.applied_axes.length
      ? "조건에 맞는 문헌"
      : "이 상황의 문헌";
    return `${scope} ${result.extended_total.toLocaleString("ko-KR")}건 중 ${first}–${last}번째`;
  }
  // 핵심 근거가 모자라 넓혀 찾은 문헌으로 채운 화면에서는 두 층을 갈라 적는다.
  //
  // 여기에 핵심 건수만 쓰면 "조건에 맞는 핵심 2건"이라고 해놓고 아래에 15건이
  // 깔린다. 합계만 쓰면 이번에는 "조건을 빼면 핵심 8건" 제안과 세는 대상이
  // 달라진다. 두 수를 같이 적어야 세 자리(머리 라벨·표시 건수 타일·조건 빼기
  // 제안)가 같은 뜻의 숫자를 쓴다.
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
    return "고른 이야기가 나온 문헌";
  if (result.expanded)
    return result.applied_axes.length
      ? "조건에 맞는 문헌 전체"
      : "이 상황의 문헌 전체";
  if (result.filter_mode === "metadata_axis_presence")
    return "고른 이야기가 나온 핵심 문헌";
  return "이 상황의 핵심 문헌";
}

function resultBasisCopy(result: ApiResult) {
  if (!result.expanded && result.extended_shown > 0)
    return `핵심 문헌만으로는 ${result.core_shown}건뿐이라, 같은 조건에 걸린 문헌 ${result.extended_shown}건을 더 찾아 붙였습니다. 뒤에 붙인 ${result.extended_shown}건은 아직 한국어로 옮기지 않아 영어 문장 그대로 보입니다. 고른 조건은 그 이야기가 초록에 나왔는지만 볼 뿐, 값을 논문 내용과 맞춰 보지는 않습니다.`;
  if (result.expanded)
    return result.applied_axes.length
      ? `이 상황의 문헌 ${result.extended_pool_total.toLocaleString("ko-KR")}건 전부에 같은 조건을 걸었습니다. 핵심 15건 밖에 있던 문헌까지 들어옵니다. 고른 조건은 그 이야기가 초록에 나왔는지만 볼 뿐, 값을 논문 내용과 맞춰 보지는 않습니다.`
      : "조건을 걸지 않고 이 상황의 문헌을 전부 폈습니다. 한 쪽에 30건씩 나눠 보여드립니다.";
  if (result.filter_mode === "metadata_axis_presence")
    return "고른 이야기가 초록에 나왔는지만 봅니다. 나이나 용량 값을 논문 내용과 하나하나 맞춰 보지는 않습니다.";
  return "조건을 걸지 않은 이 상황의 핵심 문헌입니다. 연구 질문마다 정해 둔 순서로 골라 보여드립니다.";
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
  if (role === "result_or_conclusion") return "결과·결론을 적은 문장";
  if (role === "background_or_methods") return "배경·방법을 적은 문장 · 결과 아님";
  return "어느 대목인지 못 갈랐음";
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
      <dt className="flex min-h-5 items-center gap-1.5 text-xs font-semibold text-muted">
        {label}
        {tip}
      </dt>
      <dd className="mt-2">
        <span className="text-[1.35rem] font-semibold leading-none tabular-nums text-foreground">
          {value.toLocaleString("ko-KR")}
        </span>
        <span className="ml-0.5 text-[0.8rem] font-semibold text-muted">
          {unit}
        </span>
        {note ? (
          <span className="mt-1.5 block text-[0.72rem] leading-5 text-muted">
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
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-t border-accent/15 py-4 first:border-t-0">
      <p className="col-span-2 flex flex-wrap items-center gap-x-2 text-[0.72rem] font-semibold text-accent-strong">
        <span>AI 자동 번역</span>
        <span aria-hidden="true">·</span>
        <span>{item.year || "연도 미표시"}</span>
        <span aria-hidden="true">·</span>
        <span>{kind}</span>
        <span aria-hidden="true">·</span>
        <span>문장 {sentenceIndex + 1}</span>
      </p>
      {/* 터치 영역 44px 은 유지하고 ref-hit 의 음수 여백으로 배치 폭만 1.5rem 으로
          되돌린다. 번호 배지가 본문 첫 줄과 같은 높이에서 시작한다. */}
      <a
        href={`#result-ref-${number}`}
        aria-label={`${number}번 문헌의 ${sentenceIndex + 1}번째 문장 출처로 이동`}
        className="ref-hit flex min-h-11 min-w-11 items-center justify-center no-underline"
      >
        <span className="ref-badge bg-accent text-white">{number}</span>
      </a>
      <p className="text-sm leading-6 text-foreground">{sentence}</p>
      <p lang="en" className="col-start-2 break-words text-xs leading-5 text-muted">
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
        <p className="text-sm font-semibold text-foreground">
          고른 조건으로 문헌을 찾는 중…
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
}: {
  item: EvidenceItem;
  number: number;
  /** 한국어 번역이 없는 확장 근거에만 붙는 한 줄 요약. */
  plainLine?: string;
}) {
  const metadata = [
    item.authors,
    item.venue,
    item.year ? String(item.year) : "",
    item.publication_types.split("|")[0],
  ].filter(Boolean);
  const locator = locatorLabel(item.source_locator, item.source_scope);

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
          className="break-words text-[0.95rem] font-bold leading-6 text-foreground underline decoration-border-subtle underline-offset-4 transition-colors hover:decoration-accent"
        >
          {item.title}
          <span className="sr-only"> 새 탭에서 PubMed 열림</span>
        </a>
        <p lang="en" className="mt-1.5 break-words text-xs leading-5 text-muted">
          {metadata.join(" · ") || "서지정보 미표시"}
        </p>
      </div>

      <div className="col-start-2 flex flex-wrap gap-1.5">
        <span className="chip bg-accent/10 text-accent-strong">
          {item.source_scope === "abstract_only" ? "초록까지 봄" : "제목만 봄"}
        </span>
        <span
          className={`chip ${
            item.sentence_role === "background_or_methods"
              ? "bg-warning/10 text-warning"
              : "chip-quiet"
          }`}
        >
          {item.source_scope === "title_only"
            ? "제목에서 가져와 대목을 못 가름"
            : sentenceRoleLabel(item.sentence_role)}
        </span>
      </div>

      {item.key_finding_ko ? (
        <div className="inset-block inset-block-note col-start-2">
          <p className="text-[0.72rem] font-bold text-accent-strong">
            AI 자동 번역
          </p>
          <div className="mt-1.5 space-y-2 text-sm leading-6 text-foreground">
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
        <div className="inset-block inset-block-note col-start-2">
          <p className="text-[0.72rem] font-bold text-accent-strong">AI 한 줄 요약</p>
          <p className="mt-1.5 text-sm leading-6 text-foreground">{plainLine}</p>
        </div>
      ) : null}

      <blockquote className="inset-block inset-block-quiet col-start-2">
        <p className="text-[0.72rem] font-bold text-muted">
          {item.source_scope === "title_only"
            ? `제목에서 가져옴 · ${locator}`
            : `AI 자동 추출 · ${locator}`}
        </p>
        <p lang="en" className="mt-1.5 break-words text-sm leading-6 text-foreground">
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
              <span>이 문헌에서 더 뽑은 것</span>
              <span aria-hidden="true" className="collapsible-chevron">
                ↓
              </span>
            </>
          }
        >
          <dl className="grid gap-3 p-4 text-xs leading-5">
            {item.population ? (
              <div>
                <dt className="font-bold text-foreground">연구에 참여한 사람</dt>
                <dd lang="en" className="mt-1 break-words text-muted">
                  {item.population}
                </dd>
              </div>
            ) : null}
            {item.dose ? (
              <div>
                <dt className="font-bold text-foreground">초록에 적힌 양</dt>
                <dd lang="en" className="mt-1 break-words text-muted">
                  {item.dose}
                </dd>
              </div>
            ) : null}
            {item.outcome ? (
              <div>
                <dt className="font-bold text-foreground">무엇을 봤는지</dt>
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

export function PersonalizedSafetyQuery() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [activeExample, setActiveExample] = useState("");
  const [sentence, setSentence] = useState("");
  const [interpreting, setInterpreting] = useState(false);
  const [interpreted, setInterpreted] = useState<Interpreted | null>(null);
  const [consult, setConsult] = useState<ConsultText>(null);
  const [composing, setComposing] = useState(false);
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
  // 빠르게 줄어드는데, 지금 화면은 "몇 건 남았다"까지만 말하고 어느 조건이
  // 좁혔는지는 안 알려 준다. 조회 라우트는 외부 호출이 없어 여러 번 불러도 된다.
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
  // 있고, 확장 근거만 영어 원문 문장으로 남는다(임신·용량 조건에서 15건 중 7건).
  // 기록마다 따로 부른다 — 한 번에 넘기면 개별 논문의 요지가 뭉개진다.
  const [recordLines, setRecordLines] = useState<Record<string, string>>({});
  const recordKey = result
    ? result.evidence.filter((item) => !item.key_finding_ko).map((item) => item.record_id).join("|")
    : "";
  useEffect(() => {
    if (!recordKey) {
      setRecordLines({});
      return;
    }
    const controller = new AbortController();
    const targets = (result?.evidence ?? []).filter((item) => !item.key_finding_ko);
    setRecordLines({});
    Promise.all(
      targets.slice(0, 12).map(async (item) => {
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
      }),
    ).then((pairs) => {
      if (controller.signal.aborted) return;
      setRecordLines(
        Object.fromEntries(pairs.filter(Boolean) as (readonly [string, string])[]),
      );
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordKey]);

  // 결과가 확정된 뒤에만 상담문을 만든다. 모델은 이미 고른 문헌만 읽으므로
  // 어떤 문헌이 뽑혔는지는 여기서 바뀌지 않는다. 실패하면 서버가 결정론 문단을
  // 그대로 돌려주고, 그것마저 없으면 상담문 칸을 아예 띄우지 않는다.
  useEffect(() => {
    if (!result?.narrative?.length) {
      setConsult(null);
      return;
    }
    composeRef.current?.abort();
    const controller = new AbortController();
    composeRef.current = controller;
    setComposing(true);
    // 결정론 문단을 먼저 띄웠다가 몇 초 뒤 갈아끼우면 읽는 중에 글이 바뀐다.
    // 자리만 잡아 두고, 어느 쪽으로 확정되든 한 번만 그린다.
    setConsult(null);
    // 클로저 안에서 다시 읽으면 좁혀진 타입이 풀린다. 여기서 값으로 떠 둔다.
    const deterministic = result.narrative.map((text) => ({
      text,
      recordIds: [] as string[],
    }));
    const fallback = (reason: string): ConsultText => ({
      paragraphs: deterministic,
      source: "deterministic",
      reason,
    });

    fetch("/api/consult/compose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        situation_label: result.situation_label,
        condition_line: result.query_snapshot.requested_axes
          .map((axis) => axisById.get(axis)?.label ?? axis)
          .join(" · "),
        narrative: result.narrative,
        evidence: result.evidence.map((item) => ({
          record_id: item.record_id,
          title: item.title,
          year: item.year,
          publication_types: item.publication_types,
          key_finding_ko: item.key_finding_ko,
          source_sentence: item.source_sentence,
        })),
      }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: ConsultText | null) => {
        if (controller.signal.aborted) return;
        setConsult(
          body?.paragraphs?.length
            ? {
                paragraphs: body.paragraphs,
                source: body.source,
                reason: body.reason,
              }
            : fallback("empty_response"),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setConsult(fallback("network"));
      })
      .finally(() => {
        if (composeRef.current === controller) {
          composeRef.current = null;
          setComposing(false);
        }
      });
  }, [result]);

  const run = useCallback(
    async (
      values: FormState,
      extra: { expanded?: boolean; offset?: number } = {},
      options: { scroll?: boolean } = {},
    ) => {
      if (!values.situation) {
        setError("먼저 문헌을 찾을 상황을 하나 선택하세요.");
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
          setError(body.error ?? "문헌을 찾지 못했습니다. 다시 눌러 주세요.");
          focusSoon(errorRef);
          return;
        }

        setResult(body);
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
        setError("연결이 끊겨 문헌을 찾지 못했습니다. 다시 눌러 주세요.");
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
    void run(form);
  }

  // 예시는 문장칸과 조건을 함께 채운다. 조건만 켜면 "문장으로 찾기"가 무엇을 받는
  // 칸인지 예시로는 알 수 없어서, 사람이 문장을 직접 지어내야 그 경로를 시험해 볼
  // 수 있었다. 문장까지 채워 두면 그대로 눌러 보고 고쳐 쓰는 것도 된다.
  function runExample(example: (typeof publicInputExamples)[number]) {
    setSentence(example.sentence);
    // 앞선 AI 결과가 남아 있으면 지금 문장과 다른 조건을 설명하게 된다.
    setInterpreted(null);
    setForm(example.input);
    setActiveExample(example.id);
    setError("");
    void run(example.input);
  }

  // 문장 → 조건. 여기서 나온 값은 화면의 라디오·체크박스를 켜는 데만 쓰고,
  // 근거 조회는 그다음부터 지금까지와 똑같은 결정론 경로로 돈다. 사용자가 켜진
  // 조건을 직접 고칠 수 있으므로 모델이 틀려도 막다른 길이 아니다.
  async function interpretSentence() {
    const text = sentence.trim();
    if (!text) {
      setError("찾으시는 상황을 한두 문장으로 적어 주세요.");
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
            "문장에서 다섯 상황 중 어느 것인지 찾지 못했습니다. 아래에서 직접 골라 주세요.",
        );
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
      void run(next);
    } catch {
      setInterpreted(null);
      setError("문장을 정리하지 못했습니다. 아래에서 직접 고르셔도 됩니다.");
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
      { scroll: false },
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
    focusSoon(firstSituationRef);
  }

  const staleResult = result ? !isSameQuery(form, result) : false;
  const selectedSituation = situations.find((item) => item.id === form.situation);
  const findingSentences = result
    ? flattenTranslatedFindings(result.evidence)
    : [];

  return (
    <div className="page-stack">
      <section className="card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[1.05rem] font-bold leading-snug text-foreground">
            상황과 이야기로 좁혀 보는 문헌
          </h2>
          <InfoTip label="찾는 방식">
            이 화면은 개인 상태를 판정하지 않습니다. 연구 질문 하나를 고르고, 그
            질문에 걸린 문헌 가운데 고르신 이야기가 초록에 나온 것만 남깁니다.
          </InfoTip>
        </div>

        {/* 문장으로 찾기. 모델은 조건을 켜는 일만 하고, 켜진 조건은 아래 목록에
            그대로 보이므로 사용자가 언제든 고칠 수 있다.
            예시도 이 칸 안에 둔다 — 예전에는 문장칸과 예시가 따로 떨어져 있어서,
            예시를 눌러도 문장칸은 빈 채였고 이 칸에 무엇을 적는지 예시가 보여주지
            못했다. 문장과 조건을 함께 채워야 예시 한 번으로 화면 전체가 돈다. */}
        <div className="inset-block inset-block-note mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip inline-flex bg-accent text-white">AI</span>
            <p className="text-sm font-bold text-foreground">문장으로 찾기</p>
          </div>
          <p className="mt-1.5 text-[0.8rem] leading-6 text-muted">
            겪고 계신 일을 그대로 적으면 다섯 상황 가운데 하나와 볼 이야기를 대신
            골라 드립니다. 고른 조건은 아래 목록에 그대로 켜지니 직접 고쳐도 됩니다.
            문헌을 찾는 일은 그다음부터 조건만 보고 똑같이 돌아갑니다.
          </p>
          <textarea
            value={sentence}
            onChange={(event) => setSentence(event.target.value)}
            rows={2}
            maxLength={600}
            placeholder="예: 임신 중인데 철분제를 하루 얼마씩 먹는 연구가 있는지 보고 싶어요"
            aria-label="찾으시는 상황"
            className="mt-3 block w-full resize-y rounded-[var(--radius-control)] border border-border-subtle bg-surface px-3.5 py-2.5 text-sm leading-6 text-foreground placeholder:text-muted"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void interpretSentence()}
              disabled={interpreting || pending || !sentence.trim()}
              className={`${buttonPrimary} px-4`}
            >
              {interpreting ? "조건을 고르는 중…" : "이 문장으로 찾기"}
            </button>
            <span className="text-xs leading-5 text-muted">
              값 자체와 논문 내용을 대조하지는 않습니다.
            </span>
          </div>

          <div className="mt-4 border-t border-border-subtle pt-3">
            <p className="text-[0.72rem] font-bold text-foreground">
              이렇게 적어 보세요
            </p>
            <p className="mt-1 text-[0.72rem] leading-5 text-muted">
              누르면 위 문장칸과 아래 조건을 한 번에 채우고 바로 찾아 드립니다.
            </p>
            <div className="mt-2 grid gap-1.5">
              {publicInputExamples.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  disabled={pending}
                  aria-pressed={activeExample === example.id}
                  onClick={() => runExample(example)}
                  className={`flex min-h-12 flex-col justify-center rounded-[var(--radius-control)] border px-3 py-2 text-left transition-colors disabled:cursor-wait disabled:opacity-60 ${
                    activeExample === example.id
                      ? "border-accent bg-accent/10"
                      : "border-border-subtle bg-surface hover:border-accent/40"
                  }`}
                >
                  <span className="text-[0.8rem] font-semibold leading-6 text-foreground">
                    “{example.sentence}”
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="chip chip-quiet">{example.title}</span>
                    <span className="text-[0.72rem] leading-5 text-muted">
                      {example.summary}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {activeExample ? (
              <p className="mt-2 text-[0.72rem] leading-5 text-muted">
                예시 문장을 넣고 아래 조건까지 맞춰 뒀습니다. 문장을 고쳐서 다시
                찾아보셔도 됩니다.
              </p>
            ) : null}
          </div>

          {interpreted ? (
            <div className="mt-3 border-t border-border-subtle pt-3">
              <p className="text-[0.72rem] font-bold text-accent-strong">
                이렇게 알아들었어요
              </p>
              <p className="mt-1 text-[0.8rem] leading-6 text-muted">
                {situations.find((item) => item.id === interpreted.situation)?.label ??
                  "상황 못 찾음"}
                {interpreted.applied_axes.length
                  ? ` · ${interpreted.applied_axes
                      .map((item) => axisById.get(item.axis)?.label ?? item.axis)
                      .join(" · ")}`
                  : " · 조건 없이"}
              </p>
              <p className="mt-1 text-[0.72rem] leading-5 text-muted">
                {interpreted.notice}
              </p>
              {interpreted.unavailable_axes.length ? (
                <p className="mt-1 text-[0.72rem] leading-5 text-muted">
                  {interpreted.unavailable_axes
                    .map((item) => axisById.get(item.axis)?.label ?? item.axis)
                    .join(", ")}
                  는 이 상황에 규칙이 없어 켜지 못했습니다.
                </p>
              ) : null}
              {interpreted.unmatched ? (
                <p className="mt-1 text-[0.72rem] leading-5 text-muted">
                  조건으로 못 옮긴 말: {interpreted.unmatched}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="inset-block inset-block-quiet mt-4">
          <p className="text-[0.72rem] font-bold text-foreground">직접 고르기</p>
          <p className="mt-1 break-keep text-sm leading-6 text-muted">
            상황 하나를 고르면 그 질문의 핵심 문헌을 보여드립니다. 볼 이야기를 함께
            고르면 그 이야기가 나온 문헌만 남기고, 핵심 15건 밖까지 같은 조건으로
            넓혀 볼 수 있습니다.
          </p>
        </div>

        <form
          id="evidence-query-form"
          onSubmit={submit}
          className="mt-4 scroll-mt-20 border-t border-border-subtle pt-4"
        >
          {/* 두 목록은 같은 줄 수·같은 줄 높이로 맞춰 좌우가 한 줄씩 마주 보게 한다. */}
          <div className="grid gap-4 lg:grid-cols-2">
            <fieldset className="min-w-0">
              <legend className="text-[0.95rem] font-bold text-foreground">
                1. 어떤 상황인가요
                <span className="ml-2 text-xs font-semibold text-danger">
                  필수
                </span>
              </legend>
              <p className="mt-2 text-[0.8rem] leading-6 text-muted lg:min-h-12">
                다섯 가지 가운데 하나만 고를 수 있어요. 고른 상황의 핵심 문헌부터
                보여드립니다.
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
                      <span className="block text-sm font-bold leading-5 text-foreground">
                        {situation.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-[1.125rem] text-muted">
                        핵심 문헌 {coreCoverage[situation.id]}건
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="text-[0.95rem] font-bold text-foreground">
                2. 무슨 이야기가 나온 문헌만 볼까요
                <span className="ml-2 text-xs font-semibold text-muted">
                  선택
                </span>
              </legend>
              <p className="mt-2 text-[0.8rem] leading-6 text-muted lg:min-h-12">
                고른 이야기가 초록에 나온 문헌만 남깁니다. 나이·약 이름·용량 값 자체를 대조하지 않습니다.
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
                        <span className="block text-sm font-bold leading-5">
                          {axis.label}
                        </span>
                        {/* 좁은 화면에서 잘리더라도 건수가 먼저 남도록 순서를 둔다.
                            truncate 는 nowrap 이라 min-content 를 키워 가로 넘침을
                            만들었다. line-clamp 는 줄바꿈을 막지 않는다. */}
                        <span className="mt-0.5 line-clamp-1 text-xs leading-[1.125rem] text-muted">
                          {!form.situation
                            ? "상황을 먼저 골라 주세요"
                            : unavailable
                              ? "이 상황에는 이 조건 규칙이 없어요"
                              : `${coverage}건 · ${axis.filterHint}`}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div className="sticky bottom-3 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-border-subtle bg-white/95 p-3 shadow-lg backdrop-blur sm:static sm:mt-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <button
              type="submit"
              disabled={pending}
              className={`${buttonPrimary} flex-1 font-bold disabled:cursor-wait disabled:opacity-60 sm:flex-none`}
            >
              {pending ? "문헌을 찾는 중…" : "문헌 찾기"}
            </button>
            <button type="button" onClick={reset} className={buttonQuiet}>
              고른 것 지우기
            </button>
            {selectedSituation ? (
              <span className="text-xs text-muted">
                {selectedSituation.short} · 조건 {form.axes.length}개
              </span>
            ) : null}
          </div>
        </form>
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
            aria-label="문헌 찾기 오류"
            className="card card-danger text-sm font-semibold leading-6"
          >
            {error}
          </div>
        ) : null}

        {pending && !result ? <ResultSkeleton /> : null}

        {!pending && !result && !error ? (
          <div className="card card-dashed text-center">
            <p className="text-[0.95rem] font-bold text-foreground">
              아직 찾은 문헌이 없어요
            </p>
            <p className="mx-auto mt-2 max-w-[36rem] text-sm leading-6 text-muted">
              위에서 예시를 하나 눌러 보시거나, 상황을 골라 문헌 찾기를 누르면
              여기에 결과를 보여드립니다.
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
                <p className="inset-block inset-block-note text-sm font-semibold text-accent-strong">
                  새 조건으로 다시 찾는 중이에요. 다 찾을 때까지 지금 결과를 그대로 둡니다.
                </p>
              ) : null}
              {staleResult ? (
                <p className="inset-block border border-warning/30 bg-warning/10 text-sm leading-6 text-foreground">
                  고르신 조건을 바꾸셨어요. 아래는 바꾸기 전 조건으로 찾은 결과입니다.
                </p>
              ) : null}
              {result.expanded ? (
                <p className="inset-block border border-warning/30 bg-warning/10 text-sm leading-6 text-foreground">
                  {result.applied_axes.length
                    ? `핵심 15건 밖까지 넓힌 목록에도 같은 조건을 걸었습니다. 이 상황의 문헌 ${result.extended_pool_total.toLocaleString("ko-KR")}건 가운데 ${result.extended_total.toLocaleString("ko-KR")}건이 남았습니다. `
                    : "여기는 이 상황의 문헌 전체입니다. "}
                  아직 한국어로 옮기지 않아 영어 문장 그대로 보입니다.
                </p>
              ) : null}

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-accent text-white">
                    {result.situation_label}
                  </span>
                  <span className="text-xs font-semibold text-muted">
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
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  이때 고른 조건: {result.situation_label}
                  {result.query_snapshot.requested_axes.length
                    ? ` · ${result.query_snapshot.requested_axes
                        .map((axis) => axisById.get(axis)?.label ?? axis)
                        .join(" · ")}`
                    : " · 조건 없이"}
                </p>
              </div>

              {/* 상담문. 문단은 위에 연결된 문헌만 읽고 쓴 것이고, 어떤 문헌이
                  뽑히는지는 이 칸과 무관하다. 서버 심판이 지시 표현·근거에 없는
                  숫자를 잡으면 시스템이 계산한 문단으로 되돌아온다. */}
              {composing && !consult ? (
                <div
                  aria-hidden="true"
                  className="inset-block inset-block-note flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
                    <span className="text-sm font-semibold text-muted">
                      이번 결과를 말로 풀어 쓰는 중…
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
                    <span className="chip inline-flex bg-accent text-white">
                      {consult.source === "ai_written" ? "AI 작성" : "자동 생성"}
                    </span>
                    <h3
                      id="consult-title"
                      className="text-[0.95rem] font-bold text-foreground"
                    >
                      이번 결과를 말로 풀면
                    </h3>
                    <InfoTip label="말로 풀어 쓴 글">
                      아래에 붙은 문헌만 읽고 쓴 글입니다. 어떤 문헌이 뽑히는지는 이
                      글과 상관없이 규칙 파일이 정합니다. AI가 쓴 문장에 복용 지시나
                      근거에 없는 숫자가 있으면 서버가 걸러 내고, 시스템이 계산한
                      문장을 대신 보여드립니다.
                    </InfoTip>
                  </div>
                  {consult.source === "deterministic" &&
                  consultFallbackReason(consult.reason) ? (
                    <p className="mt-2 text-[0.72rem] leading-5 text-muted">
                      {consultFallbackReason(consult.reason)}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-col gap-3 text-sm leading-6 text-foreground">
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
                            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.72rem] text-muted">
                              <span>근거</span>
                              {numbers.map((number) => (
                                <a
                                  key={number}
                                  href={`#result-ref-${number}`}
                                  className="ref-badge bg-accent/12 text-accent-strong no-underline"
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
                  <p className="mt-2 text-[0.72rem] leading-5 text-muted">
                    먹기 시작할지 끊을지, 양을 얼마로 할지는 여기서 판단하지 않습니다.
                  </p>
                </section>
              ) : null}

              <dl className="grid gap-2 sm:grid-cols-3">
                <SummaryTile
                  label={result.expanded ? "이 쪽에 보이는 것" : "지금 보이는 것"}
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
                  label="초록까지 확인한 것"
                  value={result.evidence_summary.source_scope.abstract_only}
                  unit="건"
                  note={`제목만 본 것 ${result.evidence_summary.source_scope.title_only}건`}
                />
              </dl>

              {result.filter_mode === "metadata_axis_presence" &&
              result.filter_trace.length > 1 ? (
                <div>
                  <p className="text-xs font-bold text-foreground">
                    조건을 하나씩 걸었을 때
                  </p>
                  <ol className="mt-2 flex flex-wrap items-center gap-2">
                    {result.filter_trace.map((step, index) => (
                      <li key={step.axis} className="flex items-center gap-2">
                        {index ? (
                          <span aria-hidden="true" className="text-xs text-muted">
                            →
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

              <div className="inset-block inset-block-note text-sm leading-6 text-muted">
                <p className="font-bold text-foreground">
                  이 화면이 무엇을 보여드리는지
                </p>
                <p className="mt-1">{resultBasisCopy(result)}</p>
                <p className="mt-2 text-xs leading-5">
                  AI가 초록에서 뽑은 문장 {result.evidence_summary.ai_extracted_sentences}건 · 한국어로 옮긴 문장{" "}
                  {result.evidence_summary.ai_translated_sentences}개
                  {result.evidence_summary.title_derived_records
                    ? ` · 제목에서 가져온 것 ${result.evidence_summary.title_derived_records}건`
                    : ""}
                </p>
              </div>

              {widen.length ? (
                <div className="inset-block inset-block-quiet">
                  <p className="text-xs font-bold text-foreground">조건을 빼면</p>
                  <p className="mt-1 text-[0.8rem] leading-6 text-muted">
                    조건을 여러 개 걸수록 남는 문헌이 빠르게 줄어듭니다. 하나씩
                    빼면 몇 건이 되는지 미리 세어 봤어요. 맨 위에 적힌 핵심{" "}
                    {result.core_shown}건과 같은 방식으로 센 숫자이고, 화면에는
                    여기에 넓혀 찾은 문헌을 더해 보여드립니다.
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
                          void run(next);
                        }}
                        className={`${buttonQuiet} min-h-10 px-3 text-xs`}
                      >
                        {axisById.get(row.axis)?.label ?? row.axis} 빼면 핵심 {row.count}건
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
                      className="text-[0.95rem] font-bold text-foreground"
                    >
                      AI가 뽑아 옮긴 문장
                    </h3>
                    <InfoTip label="AI 자동 추출 문장">
                      초록 문장 가운데 점수가 높은 것을 골라 AI가 한국어로 옮겼습니다.
                      사람이 원문과 맞춰 본 문장이라는 뜻은 아닙니다.
                    </InfoTip>
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-muted">
                    문장마다 어느 문헌에서 가져왔는지 번호를 붙였습니다. 번호를
                    누르면 그 문헌으로 갑니다.
                  </p>
                  <ol className="inset-block-note mt-3 rounded-[var(--radius-control)] px-4">
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
                      summaryClassName="disclosure-summary text-accent-strong"
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
                    문헌 목록으로 내려가기
                  </a>
                  <a
                    href="#evidence-query-form"
                    className={`${buttonQuiet} no-underline`}
                  >
                    조건 다시 고르기
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
                <p className="text-sm leading-6 text-muted">
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
                <p className="inset-block border border-warning/30 bg-warning/10 text-sm leading-6 text-foreground">
                  이 상황에는 {result.unavailable_axes
                    .map((item) => axisById.get(item.axis)?.label ?? item.axis)
                    .join(", ")} 규칙이 없어 그 조건은 걸지 못했습니다.
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
                    />
                  );
                })}
              </ol>
            ) : (
              <div className="card-section">
                <p className="text-sm leading-6 text-muted">
                  {result.expanded
                    ? "고르신 이야기를 한 편에서 모두 말한 문헌이 넓힌 목록에도 없습니다."
                    : result.filter_mode === "metadata_axis_presence"
                      ? "고르신 이야기를 한 편에서 모두 말한 핵심 문헌이 없습니다."
                      : "이 상황에는 보여드릴 핵심 문헌이 없습니다."}
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
                      void run(next);
                    }}
                    disabled={pending}
                    className={`${buttonQuiet} mt-4 border-accent/40 font-bold text-accent-strong`}
                  >
                    마지막 조건 하나 빼기
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
                <p className="text-xs leading-5 text-muted">
                  {result.extended_note}
                </p>
              </div>
            ) : null}

            <footer className="card-section rounded-b-[var(--radius-card)] bg-accent/5 text-xs leading-5 text-muted">
              {result.disclaimer || evidenceOnlyDisclaimer}
            </footer>
          </article>
        ) : null}
      </div>
    </div>
  );
}
