"use client";

import {
  type FormEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatedDetails } from "@/src/components/animated-details";
import { isRetractedPublication, retractedPublicationNotice } from "@/src/lib/publication-status";
import { studyKind, withoutStatistics } from "@/src/lib/plain-reading";
import { elapsedLabel, readConsultResponse } from "@/src/lib/consult-stream";
import { COMPOSE_ROLES, groundedFallback, plainLanguage, readableSource } from "@/src/lib/consult-compose";
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
import { readValueQuery, valueMarks } from "@/src/lib/value-match";
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
  /** 적어 주신 성분, 나이, 양과 맞춰 본 결과. 알 수 없으면 null. */
  value_match?: { ingredient: boolean | null; age: boolean | null; dose: boolean | null };
};

type ValueSummary = {
  ingredients: string[];
  age: number | null;
  dose: string | null;
  ingredient_matches: number;
  age_matches: number;
  dose_matches: number;
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
  value_summary?: ValueSummary | null;
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

/** 문장 정리기가 돌려주는 것. 값이 아니라 어떤 축을 켤지만 화면에 반영한다. */
type Interpreted = {
  situation: SituationId | null;
  values?: Record<string, string>;
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
  /**
   * interim   모델을 기다리는 동안 서버 원자료로 정리한 문단
   * streaming 문단 하나가 도착해 그 자리만 바뀐 상태
   * final     세 문단이 다 확정된 상태
   */
  stage?: "interim" | "streaming" | "final";
  /** streaming 일 때 지금까지 도착한 문단 수. */
  arrived?: number;
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
  // 문단 셋 가운데 일부만 AI 해설이 붙은 경우. 어느 자리가 정리 문단으로 남았는지
  // 말해 주지 않으면 같은 칸에 두 종류 글이 섞인 것을 읽는 사람이 알 수 없다.
  if (reason.startsWith("partial_fallback:")) {
    const failed = reason.slice("partial_fallback:".length).split(",").filter(Boolean);
    return `해설 세 문단 가운데 ${failed.length}개는 AI 해설을 쓰지 못해 문헌별 요약으로 두었습니다(${failed.map(consultFallbackShort).join(", ")}).`;
  }
  if (reason === "no_key")
    return "AI 해설 기능이 연결되지 않아 문헌별 요약을 표시합니다.";
  if (reason === "no_evidence")
    return "해설에 연결할 문헌이 없습니다. 선택한 조건을 넓혀 다시 조회하세요.";
  if (reason === "refereed_out")
    return "AI 해설이 출처 확인 기준을 통과하지 못해 문헌별 요약을 표시합니다.";
  if (reason === "timeout")
    return "제한 시간 안에 AI 해설을 작성하지 못해 문헌별 요약을 표시합니다. 다시 조회하면 해설을 다시 요청합니다.";
  if (reason === "rate_limited")
    return "요청이 많아 AI 해설을 작성하지 못해 문헌별 요약을 표시합니다. 잠시 뒤 다시 조회할 수 있습니다.";
  return "AI 해설을 받지 못해 문헌별 요약을 표시합니다. 다시 조회하면 해설을 다시 요청합니다.";
}

/** 문단 하나가 정리로 남은 까닭을 짧은 말로. 긴 안내문은 위 함수가 따로 쓴다. */
function consultFallbackShort(reason: string) {
  if (reason === "timeout") return "시간 초과";
  if (reason === "refereed_out") return "출처 확인 기준 미통과";
  if (reason === "incomplete") return "작성이 중간에 끝남";
  if (reason === "rate_limited") return "요청 몰림";
  if (reason === "empty" || reason === "bad_json") return "응답 형식 오류";
  return "호출 실패";
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
    const scope = result.applied_axes.length ? "조건에 맞는 연구" : "이 상황의 문헌";
    return `${scope} ${result.extended_total.toLocaleString("ko-KR")}편 중 ${first}~${last}번째`;
  }
  // AI 검토 연구가 모자라 추가 후보로 채운 화면에서는 두 층을 갈라 적는다.
  if (result.extended_shown > 0) {
    return `AI 검토 연구 ${result.core_shown.toLocaleString("ko-KR")}편, 추가 후보 ${result.extended_shown.toLocaleString("ko-KR")}편`;
  }
  if (result.filter_mode === "metadata_axis_presence") {
    return `조건에 맞는 AI 검토 연구 ${result.evidence_total_after_filter.toLocaleString("ko-KR")}편`;
  }
  return `AI 검토 연구 ${result.evidence_total_after_filter.toLocaleString("ko-KR")}편`;
}

/** 적어 주신 값과 목록을 맞춰 본 결과를 한 줄로. 읽은 값이 없으면 줄을 그리지 않는다. */
function valueSummaryLine(summary: ValueSummary | null | undefined, total: number) {
  if (!summary) return "";
  const parts = [
    summary.ingredients.length ? `${summary.ingredients.join(", ")} 성분 ${summary.ingredient_matches}편` : "",
    summary.age !== null ? `${summary.age}세 나이대 ${summary.age_matches}편` : "",
    summary.dose ? `${summary.dose} 전후 용량 ${summary.dose_matches}편` : "",
  ].filter(Boolean);
  return parts.length ? `적어 주신 내용과 맞는 연구: ${parts.join(", ")} (목록 ${total}편 기준)` : "";
}

function resultHeading(result: ApiResult) {
  const name = situations.find((item) => item.id === result.situation)?.short ?? result.situation_label;
  if (result.expanded) return `${name} 관련 연구 전체`;
  return `${name} 관련 연구`;
}

function resultBasisCopy(result: ApiResult) {
  if (!result.expanded && result.extended_shown > 0)
    return `AI가 다시 검토한 연구 ${result.core_shown}편에, AI 선별만 거친 추가 후보 ${result.extended_shown}편을 더했습니다. 추가 후보는 결과 문장을 한국어로 옮기지 않았습니다. 고른 조건은 제목과 초록에 그 내용이 나오는지만 보고, 입력한 값과 논문의 값을 대조하지 않습니다.`;
  if (result.expanded)
    return result.applied_axes.length
      ? `이 상황의 후보 ${result.extended_pool_total.toLocaleString("ko-KR")}편에 같은 조건을 걸었습니다. 후보는 AI 선별만 거친 자료입니다. 조건은 제목과 초록에 그 내용이 나오는지만 보며, 값을 논문 내용과 맞춰 보지는 않습니다.`
      : "이 상황의 후보를 30편씩 보여 드립니다. 후보는 AI 선별만 거친 자료입니다.";
  if (result.filter_mode === "metadata_axis_presence")
    return "고른 조건이 제목과 초록에 나오는지만 봅니다. 나이나 용량 값을 논문 내용과 하나하나 대조하지는 않습니다.";
  return "조건 없이 이 상황에서 AI가 다시 검토한 연구를 정해진 순서로 보여 드립니다.";
}

function resultStatusMessage(result: ApiResult) {
  if (result.expanded) {
    const scope = result.applied_axes.length ? "조건에 맞는 연구" : "이 상황의 문헌";
    if (!result.evidence.length)
      return `${scope} ${result.extended_total.toLocaleString("ko-KR")}편 가운데 보여 드릴 것이 없습니다.`;
    const first = result.expanded_offset + 1;
    const last = result.expanded_offset + result.evidence.length;
    return `${scope} ${result.extended_total.toLocaleString("ko-KR")}편 가운데 ${first}번째부터 ${last}번째까지 보여 드립니다.`;
  }
  if (result.extended_shown > 0) {
    return `AI 검토 연구 ${result.core_shown}편에 추가 후보 ${result.extended_shown}편을 더해 모두 ${result.evidence.length}편을 보여 드립니다.`;
  }
  return `연구 ${result.evidence.length}편을 보여 드립니다.`;
}

/** 조건 이름을 처음 보는 사람이 읽는 말로. 연구 자료와 지시문은 원래 이름을 그대로 쓴다. */
const plainAxis: Record<AxisId, { label: string; hint: string }> = {
  age_group: { label: "나이", hint: "나이나 연령대를 다룬 연구" },
  concomitant_medication: { label: "다른 약", hint: "다른 약과 함께 쓴 경우를 다룬 연구" },
  dose_range: { label: "복용량", hint: "mg, IU 같은 양이 적힌 연구" },
  sex: { label: "성별", hint: "남녀를 나누어 본 연구" },
  underlying_condition: { label: "지병", hint: "함께 앓는 병을 다룬 연구" },
};

function axisName(axis: AxisId) {
  return plainAxis[axis]?.label ?? axisById.get(axis)?.label ?? axis;
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
        <p className="text-[0.9375rem] font-bold text-foreground">
          연구를 찾는 중
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
  isCore,
}: {
  item: EvidenceItem;
  number: number;
  /** 검토를 마친 핵심 문헌인지. 조회 결과는 핵심 문헌을 앞에 두므로 순번으로 정한다. */
  isCore: boolean;
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

  const plainFinding = item.key_finding_ko
    ? withoutStatistics(plainLanguage(readableSource(item.key_finding_ko)))
    : "";

  return (
    <li
      id={`result-ref-${number}`}
      className="evidence-record grid scroll-mt-24 grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3 py-5"
    >
      <span className="ref-badge bg-foreground text-white">{number}</span>
      <div className="min-w-0">
        <p className="record-kicker">
          <span>{studyKind(item.publication_types)}</span>
          {item.year ? <span>{item.year}년</span> : null}
          <span className={isCore ? "record-tag" : "record-tag record-tag-quiet"}>
            {isCore ? "AI 검토 연구" : "추가 후보"}
          </span>
          {item.value_match?.ingredient ? <span className="record-tag record-tag-match">성분 일치</span> : null}
          {item.value_match?.age ? <span className="record-tag record-tag-match">나이대 일치</span> : null}
          {item.value_match?.dose ? <span className="record-tag record-tag-match">용량 일치</span> : null}
        </p>

        {/* 첫 줄은 무엇을 알아냈는지다. 괄호 속 통계는 접고, 원래 문장은 아래 '자세히'에 둔다. */}
        {plainFinding ? (
          <div className="record-plain">
            {splitEvidenceSentences(plainFinding).map((sentence, sentenceIndex) => (
              <p key={`${item.record_id}-plain-${sentenceIndex}`}>{sentence}</p>
            ))}
          </div>
        ) : plainLine ? (
          <p className="record-plain motion-enter">{plainLine}</p>
        ) : pendingLine ? (
          <span aria-hidden="true" className="mt-1 block">
            <span className="loading-skeleton block h-4 w-full rounded" />
            <span className="loading-skeleton mt-1.5 block h-4 w-4/5 rounded" />
          </span>
        ) : (
          <p className="record-plain text-muted">한국어 요약이 아직 없습니다. 아래 원문 제목과 자세히에서 영어 문장을 볼 수 있습니다.</p>
        )}
        {item.sentence_role === "background_or_methods" ? (
          <p className="mt-1 text-[0.8125rem] font-bold text-warning">
            이 문장은 연구 결과가 아니라 배경이나 방법을 설명한 부분입니다.
          </p>
        ) : null}

        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          lang="en"
          className="record-title"
        >
          {item.title}
          <span className="sr-only"> 새 탭에서 PubMed 열림</span>
        </a>
        <p lang="en" className="mt-1 break-words text-[0.8125rem] leading-5 text-muted">
          {metadata.join(", ") || "서지정보 미표시"}
        </p>
      </div>

      <AnimatedDetails
        className="disclosure col-start-2"
        summaryClassName="disclosure-summary text-muted"
        bodyClassName="disclosure-body"
        summary={
          <>
            <span>자세히 보기 (숫자, 연구 대상, 원문)</span>
            <span aria-hidden="true" className="collapsible-chevron">
              ↓
            </span>
          </>
        }
      >
        <dl className="record-fields m-4">
          <div>
            <dt>검토 상태</dt>
            <dd>
              {isCore
                ? "AI 사후 검토로 주제, 요약, 번역을 다시 확인한 핵심 문헌"
                : "AI 선별만 거친 추가 후보. 개별 검토는 하지 않음"}
            </dd>
          </div>
          {item.key_finding_ko ? (
            <div>
              <dt>결과 (AI 자동 번역)</dt>
              <dd className="record-finding">
                {splitEvidenceSentences(item.key_finding_ko).map((sentence, sentenceIndex) => (
                  <p key={`${item.record_id}-detail-${sentenceIndex}`}>{sentence}</p>
                ))}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>
              {item.source_scope === "title_only"
                ? `원문 (제목에서 추출, ${locator})`
                : `원문 (AI 자동 추출, ${locator})`}
            </dt>
            <dd lang="en">
              {item.source_sentence || "가져올 원문 문장이 없습니다."}
              <span className="mt-1 block text-[0.8125rem] text-muted" lang="ko">
                {item.source_scope === "title_only"
                  ? "제목에서 추출, 문장 위치 미분류"
                  : sentenceRoleLabel(item.sentence_role)}
              </span>
            </dd>
          </div>
          <div>
            <dt>연구 대상</dt>
            <dd lang="en">{item.population || "초록에 따로 적히지 않음"}</dd>
          </div>
          <div>
            <dt>초록의 양 표기</dt>
            <dd lang="en">{item.dose || "초록에 적힌 양 없음"}</dd>
          </div>
          {item.outcome ? (
            <div>
              <dt>평가 항목</dt>
              <dd lang="en">{item.outcome}</dd>
            </div>
          ) : null}
        </dl>
      </AnimatedDetails>
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
  // 조회 요청이 그 순간의 해석 값을 읽도록 ref 에도 둔다.
  const interpretedRef = useRef<Interpreted | null>(null);
  useEffect(() => {
    interpretedRef.current = interpreted;
  }, [interpreted]);
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
    //
    // 예전에는 결과 문장(key_finding_ko 또는 영어 원문)을 그대로 세 줄 늘어놨다.
    // 그러면 "eGFR 4.2 mL/min/1.73m2 감소(P=0.03)" 같은 줄만 남아, 그 연구가 누구를
    // 대상으로 얼마를 얼마나 오래 썼는지도, 적어 넣은 상황과 어떻게 이어지는지도
    // 화면에 없었다. 서버가 기다리는 동안 쓰는 것과 같은 생성기로 바꾼다.
    const deterministic = groundedFallback(
      result.evidence
        .filter((item) => !isRetractedPublication(item.publication_types))
        .map((item) => ({
          recordId: item.record_id,
          title: item.title,
          year: String(item.year),
          publicationTypes: item.publication_types,
          abstract: "",
          finding: item.source_sentence || item.key_finding || "",
          findingKo: item.key_finding_ko || "",
          population: item.population || "",
          dose: item.dose || "",
          outcome: item.outcome || "",
          locator: "",
          url: "",
          // 한국어 결과 문장이 붙은 것이 검토를 마친 핵심 근거다.
          reviewed: Boolean(item.key_finding_ko),
        })),
      result.situation_label,
      {
        conditionLine: result.query_snapshot.requested_axes
          .map((axis) => axisById.get(axis)?.label ?? axis)
          .join(", "),
        patientContext: result.patient_context ?? "",
      },
    );
    const fallback = (reason: string): NonNullable<ConsultText> => ({
      paragraphs: deterministic,
      source: "deterministic",
      reason,
      stage: "final",
    });
    let interim: ConsultParagraph[] = [];
    // 도착한 문단을 자리 번호로 들고 있다가, 오는 대로 그 자리만 갈아 끼운다.
    const streamed = new Map<number, ConsultParagraph>();

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
          // 문단 하나가 끝났다. 그 자리만 바꾸고 나머지는 정리 문단으로 둔다.
          if (event.type === "partial") {
            streamed.set(event.index, event.paragraph);
            setConsultElapsedMs(event.elapsedMs);
            const base = interim.length ? interim : deterministic;
            const merged = Array.from(
              { length: Math.max(base.length, COMPOSE_ROLES.length) },
              (_, index) => streamed.get(index) ?? base[index],
            ).filter(Boolean);
            setConsult({
              paragraphs: merged,
              source: "deterministic",
              reason: "generating",
              stage: "streaming",
              arrived: streamed.size,
            });
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
      extra: { expanded?: boolean; offset?: number; marks?: ReturnType<typeof valueMarks> } = {},
      options: { scroll?: boolean; patientContext?: string } = {},
    ) => {
      // 문장으로 찾았을 때만 성분, 나이, 양을 문헌과 대조한다. 문장은 여기서 읽고
      // 조회 요청에는 읽은 결과만 싣는다. 목록과 순서는 바뀌지 않는다.
      if (options.patientContext && !extra.marks) {
        const marks = valueMarks(
          readValueQuery({
            text: options.patientContext,
            age: interpretedRef.current?.values?.age ?? "",
            dose: interpretedRef.current?.values?.dose ?? "",
          }),
        );
        if (marks) extra = { ...extra, marks };
      }
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
    interpretedRef.current = null;
    setInterpreted(null);
    setForm(example.input);
    setActiveExample(example.id);
    // 열 개짜리 목록은 접어 둔다. 무엇이 채워졌는지는 검색칸 아래 'AI가 읽은 내용'과
    // 결과 머리의 '함께 본 내용'이 보여 준다. 고칠 사람만 펼친다.
    setPickerOpen(false);
    setError("");
    void run(example.input, {}, { patientContext: example.sentence });
  }

  // 빈 화면에서 상황 하나를 바로 고르는 길. 조건 없이 그 상황의 핵심 문헌부터 본다.
  function browseSituation(situation: SituationId) {
    const input = { situation, axes: [] as AxisId[] };
    setSentence("");
    setInterpreted(null);
    setForm(input);
    setActiveExample("");
    setPickerOpen(false);
    setError("");
    void run(input, {});
  }

  // 문장 → 조건. 여기서 나온 값은 화면의 라디오와 체크박스를 켜는 데만 쓰고,
  // 근거 조회는 그다음부터 지금까지와 똑같은 결정론 경로로 돈다. 사용자가 켜진
  // 조건을 직접 고칠 수 있으므로 모델이 틀려도 막다른 길이 아니다.
  async function interpretSentence() {
    const text = sentence.trim();
    if (!text) {
      setError("지금 상황을 한두 문장으로 적어 주세요.");
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
            "문장에서 해당하는 상황을 찾지 못했습니다. 아래에서 상황을 직접 골라 주세요.",
        );
        setPickerOpen(true);
        focusSoon(firstSituationRef);
        return;
      }
      const next: FormState = {
        situation: body.situation,
        axes: body.applied_axes.map((item) => item.axis),
      };
      interpretedRef.current = body;
      setInterpreted(body);
      setForm(next);
      setActiveExample("");
      setPickerOpen(false);
      void run(next, {}, { patientContext: text });
    } catch {
      setInterpreted(null);
      setError("문장을 읽지 못했습니다. 아래에서 상황을 직접 고를 수 있습니다.");
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
          <h1 id="page-title" className="hero-title">
            상황별 보충제 연구 찾기
          </h1>
          <p className="hero-lead">
            수술을 앞두었거나, 콩팥이나 간이 안 좋거나, 임신 중이거나, 피를 묽게 하는 약을 먹을 때
            영양제를 다룬 연구를 찾아 쉬운 말로 설명해 드립니다.
          </p>

          <div className="hero-search">
            <textarea
              value={sentence}
              onChange={(event) => setSentence(event.target.value)}
              rows={1}
              maxLength={600}
              placeholder="예: 임신 중인데 철분제를 하루 30mg 먹고 있어요"
              aria-label="찾으려는 상황"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void interpretSentence();
                }
              }}
            />
            <div className="hero-search-actions">
              <button
                type="button"
                onClick={() => void interpretSentence()}
                disabled={interpreting || pending || !sentence.trim()}
                className="hero-submit"
              >
                {interpreting ? "읽는 중" : "찾기"}
              </button>
            </div>
          </div>

          {/* 예시 질문. 누르면 문장까지 채우고 바로 조회한다. */}
          <div className="hero-examples" aria-label="예시 질문">
            <span className="hero-examples-label">예시</span>
            {publicInputExamples.map((example) => (
              <button
                key={example.id}
                type="button"
                disabled={pending}
                aria-pressed={activeExample === example.id}
                title={example.sentence}
                onClick={() => runExample(example)}
                className="hero-example"
              >
                {example.short}
              </button>
            ))}
          </div>
          <p className="hero-search-hint">
            AI가 문장을 읽고 상황을 고르면, 그 상황을 다룬 연구를 보여 드립니다. 복용 여부를 정해 주지는 않습니다.
          </p>

          {interpreted ? (
            <div className="hero-note motion-enter">
              <strong>AI가 읽은 내용</strong>
              <p>
                {interpretedSituation?.label ?? "상황 미확인"}
                {interpreted.applied_axes.length
                  ? `, 추가 조건: ${interpreted.applied_axes
                      .map((item) => axisName(item.axis))
                      .join(", ")}`
                  : ""}
              </p>
              {interpreted.notice ? (
                <p className="hero-note-sub">{interpreted.notice}</p>
              ) : null}
              {interpreted.unavailable_axes.length ? (
                <p className="hero-note-sub">
                  {interpreted.unavailable_axes
                    .map((item) => axisName(item.axis))
                    .join(", ")}
                  은(는) 이 상황에서 따로 고를 수 없어 뺐습니다.
                </p>
              ) : null}
              {interpreted.unmatched ? (
                <p className="hero-note-sub">
                  조건으로 옮기지 못한 말: {interpreted.unmatched}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <div className="page-shell page-stack px-4 py-8 sm:px-6 sm:py-10">
        <section className="query-panel">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-[1.0625rem] font-bold leading-snug text-foreground">
              상황 직접 고르기
            </h2>
            <p className="text-[0.875rem] leading-6 text-muted">
              문장을 쓰는 대신 상황과 추가 조건을 직접 고를 수 있습니다.
            </p>
          </div>

          {/* 라디오와 체크박스 열 개는 접어 둔다. 문장으로 조회하면 이 안이 이미
              채워져 있고, 고칠 사람만 펼친다. */}
          <div className="mt-3 border-t border-border-subtle pt-1">
            <button
              type="button"
              aria-expanded={pickerOpen}
              aria-controls="evidence-query-form"
              onClick={() => setPickerOpen((open) => !open)}
              className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
            >
              <span className="text-base font-bold text-foreground">{pickerOpen ? "접기" : "펼치기"}</span>
              <span className="flex items-center gap-2 text-[0.8125rem] leading-5 text-muted">
                {selectedSituation
                  ? `${selectedSituation.short}, 추가 조건 ${form.axes.length}개`
                  : "아직 고르지 않음"}
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
                  1. 상황
                  <span className="ml-2 text-[0.8125rem] font-bold text-danger">
                    필수
                  </span>
                </legend>
                <p className="mt-2 text-[0.9375rem] leading-6 text-muted lg:min-h-12">
                  지금 해당하는 상황 하나를 고릅니다.
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
                          AI 검토 연구 {coreCoverage[situation.id]}편
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="min-w-0">
                <legend className="text-base font-bold text-foreground">
                  2. 추가 조건
                  <span className="ml-2 text-[0.8125rem] font-bold text-muted">
                    선택
                  </span>
                </legend>
                <p className="mt-2 text-[0.9375rem] leading-6 text-muted lg:min-h-12">
                  고른 내용을 다룬 연구만 남깁니다. 나이나 용량 값 자체를 대조하지 않습니다.
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
                            {axisName(axis.id)}
                          </span>
                          {/* 좁은 화면에서 잘리더라도 건수가 먼저 남도록 순서를 둔다. */}
                          <span className="mt-0.5 line-clamp-1 text-[0.8125rem] leading-[1.125rem] text-muted">
                            {!form.situation
                              ? "상황을 먼저 고르세요"
                              : unavailable
                                ? "이 상황에서는 고를 수 없음"
                                : `${coverage}편, ${plainAxis[axis.id]?.hint ?? axis.filterHint}`}
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
                {pending ? "찾는 중" : "연구 찾기"}
              </button>
              <button type="button" onClick={reset} className={buttonQuiet}>
                초기화
              </button>
              {selectedSituation ? (
                <span className="text-[0.8125rem] text-muted">
                  {selectedSituation.short}, 추가 조건 {form.axes.length}개
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
            <section aria-labelledby="browse-title">
              <div className="section-head">
                <h2 id="browse-title" className="section-title">
                  상황별 연구 바로 보기
                </h2>
                <p className="section-sub">AI 검토 연구 우선</p>
              </div>
              <ul className="browse-list">
                {situations.map((situation) => (
                  <li key={situation.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => browseSituation(situation.id)}
                      className="browse-row"
                    >
                      <span className="browse-name">{situation.label}</span>
                      <span className="browse-count">AI 검토 연구 {coreCoverage[situation.id]}편</span>
                      <span aria-hidden="true" className="browse-go">
                        보기
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
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
                    {/* 이때 고른 조건. 지금 입력칸이 아니라 이 결과를 만든 조회 기록을 읽는다. */}
                    추가 조건:{" "}
                    {result.query_snapshot.requested_axes.length
                      ? result.query_snapshot.requested_axes.map((axis) => axisName(axis)).join(", ")
                      : "없음"}
                  </p>
                  {valueSummaryLine(result.value_summary, result.evidence.length) ? (
                    <p className="mt-1 text-[0.9375rem] leading-6 text-muted">
                      {valueSummaryLine(result.value_summary, result.evidence.length)}
                    </p>
                  ) : null}
                </div>

                {/* 결과 해설. 문단은 위에 연결된 문헌만 읽고 쓴 것이고, 어떤 문헌이
                    뽑히는지는 이 칸과 무관하다. 서버 심판이 지시 표현이나 근거에 없는
                    숫자를 잡으면 시스템이 계산한 문단으로 되돌아온다. */}
                {composing && !consult ? (
                  <div
                    aria-hidden="true"
                    className="inset-block inset-block-note flex flex-col gap-2"
                  >
                    <span className="text-[0.9375rem] font-bold text-muted">
                      연구별 요약을 불러오는 중
                    </span>
                    <span className="loading-skeleton block h-4 w-full rounded" />
                    <span className="loading-skeleton block h-4 w-11/12 rounded" />
                    <span className="loading-skeleton block h-4 w-3/4 rounded" />
                  </div>
                ) : null}

                {consult ? (
                  <section
                    aria-labelledby="consult-title"
                    className="consult-block"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        id="consult-title"
                        className="text-base font-bold text-foreground"
                      >
                        연구 설명
                      </h3>
                      <span className="consult-state">
                        {consult.stage === "interim"
                          ? "연구별 요약"
                          : consult.stage === "streaming"
                            ? `AI 설명 ${consult.arrived ?? 0}/${COMPOSE_ROLES.length}`
                            : consult.source === "ai_written"
                              ? "AI 설명"
                              : "연구별 요약"}
                      </span>
                      {consult.stage === "interim" || consult.stage === "streaming" ? (
                        <span className="text-[0.8125rem] font-semibold text-muted">
                          AI가 연구를 읽고 설명을 쓰는 중
                          {consultElapsedMs > 0 ? ` (${elapsedLabel(consultElapsedMs)})` : ""}
                        </span>
                      ) : null}
                    </div>
                    {consult.stage === "interim" || consult.stage === "streaming" ? (
                      <p className="mt-2 text-[0.8125rem] leading-5 text-muted">
                        설명이 끝나기 전까지 연구별 요약을 먼저 보여 드립니다.
                      </p>
                    ) : consultFallbackReason(consult.reason) ? (
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
                                <span>출처 연구</span>
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
                          연구별 요약 보기
                        </summary>
                        <div className="mt-2 flex flex-col gap-2">
                          {consult.interim.map((paragraph, index) => (
                            <p key={`interim-${index}`}>{paragraph.text}</p>
                          ))}
                        </div>
                      </details>
                    ) : null}
                    <p className="mt-3 text-[0.8125rem] leading-5 text-muted">
                      AI가 아래 연구의 초록만 읽고 쓴 설명입니다. 먹어도 되는지, 얼마나 먹을지는 정해 주지 않으니
                      복용은 의사나 약사와 상의하세요.
                    </p>
                  </section>
                ) : null}

                {widen.length ? (
                  <div>
                    <p className="text-[0.8125rem] font-bold text-foreground">연구를 더 보려면</p>
                    <p className="mt-1 text-[0.875rem] leading-6 text-muted">
                      추가 조건을 하나 빼면 AI 검토 연구가 몇 편 남는지 미리 세었습니다.
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
                          {axisName(row.axis)} 빼면 {row.count}편
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {result.evidence.length ? (
                  <nav aria-label="결과 안에서 이동" className="result-jump">
                    <a href="#evidence-list">연구 목록으로</a>
                    <a
                      href="#evidence-query-form"
                      onClick={(event) => {
                        // 목록이 접혀 있으면 이동할 자리가 없다. 먼저 펼친 뒤 그 자리로 간다.
                        event.preventDefault();
                        setPickerOpen(true);
                        window.requestAnimationFrame(() =>
                          document.getElementById("evidence-query-form")?.scrollIntoView({ block: "start" }),
                        );
                      }}
                    >
                      조건 바꾸기
                    </a>
                  </nav>
                ) : null}

                <AnimatedDetails
                  className="disclosure"
                  summaryClassName="disclosure-summary text-foreground"
                  bodyClassName="disclosure-body p-4"
                  summary={
                    <>
                      <span>검색 방법과 자료 범위</span>
                      <span aria-hidden="true" className="collapsible-chevron">
                        ↓
                      </span>
                    </>
                  }
                >
                  <dl className="record-fields">
                    <div>
                      <dt>표시한 연구</dt>
                      <dd>
                        <p>
                          {[
                            `표시 ${result.evidence_summary.displayed_records.toLocaleString("ko-KR")}건${
                              result.extended_shown > 0
                                ? `(핵심 ${result.core_shown}, 추가 후보 ${result.extended_shown})`
                                : ""
                            }`,
                            `겹치는 제목 뺀 문헌 ${result.evidence_summary.unique_titles.toLocaleString("ko-KR")}편`,
                            `초록 확인 ${result.evidence_summary.source_scope.abstract_only}건`,
                            result.evidence_summary.source_scope.title_only
                              ? `제목만 확인 ${result.evidence_summary.source_scope.title_only}건`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                        {result.filter_mode === "metadata_axis_presence" &&
                        result.filter_trace.length > 1 ? (
                          <p>
                            조건별 남은 핵심 문헌:{" "}
                            {result.filter_trace
                              .map((step) => `${step.label} ${step.count}건`)
                              .join(" › ")}
                          </p>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt>조회 기준</dt>
                      <dd>{resultBasisCopy(result)}</dd>
                    </div>
                    <div>
                      <dt>AI 처리</dt>
                      <dd>
                        초록에서 뽑은 문장 {result.evidence_summary.ai_extracted_sentences}건, 한국어로 옮긴 문장{" "}
                        {result.evidence_summary.ai_translated_sentences}개
                        {result.evidence_summary.title_derived_records
                          ? `, 제목에서 가져온 것 ${result.evidence_summary.title_derived_records}건`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>연구 질문</dt>
                      <dd>{result.research_question}</dd>
                    </div>
                    {result.checks.length ? (
                      <div>
                        <dt>확인 항목</dt>
                        <dd>{result.checks.join(", ")}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {!result.expanded && findingSentences.length ? (
                    <>
                      <p id="evidence-findings-title" className="mt-4 text-[0.875rem] font-bold text-foreground">
                        초록 결과 문장 모아 보기 ({findingSentences.length}개)
                      </p>
                      <p className="mt-1 text-[0.8125rem] leading-5 text-muted">
                        AI 검토 연구의 초록에서 AI가 뽑아 한국어로 옮긴 결과 문장입니다. 번호를 누르면 그 연구로 이동합니다.
                      </p>
                      <ol>
                        {findingSentences.map((finding) => (
                          <EvidenceFinding
                            key={`${finding.item.record_id}-summary-${finding.sentenceIndex}`}
                            item={finding.item}
                            number={finding.paperNumber}
                            sentence={finding.sentence}
                            sentenceIndex={finding.sentenceIndex}
                          />
                        ))}
                      </ol>
                    </>
                  ) : null}
                </AnimatedDetails>

                {result.unavailable_axes.length ? (
                  <p className="inset-block border border-warning/30 bg-warning/10 text-[0.9375rem] leading-6 text-foreground">
                    이 상황에서는 {result.unavailable_axes
                      .map((item) => axisName(item.axis))
                      .join(", ")}을(를) 따로 고를 수 없어 빼고 찾았습니다.
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
                        isCore={!result.expanded && index < result.core_shown}
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
