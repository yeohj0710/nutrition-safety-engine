import "server-only";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { situations } from "@/src/lib/clinical-situations";
import { groundedFallback, type ComposeSource } from "@/src/lib/consult-compose";
import { isRetractedPublication } from "@/src/lib/publication-status";
import type { ComposedParagraph } from "@/src/lib/consult-referee";

export type ConsultSource = ComposeSource;
const loaded = new Map<string, Promise<Record<string, ConsultSource>>>();

export async function loadConsultSources(situation: string, ids: string[]): Promise<ConsultSource[]> {
  if (!situations.some(item => item.id === situation)) return [];
  let promise = loaded.get(situation);
  if (!promise) {
    promise = readFile(path.join(process.cwd(), "research/consult", `${situation}.json.gz`))
      .then(bytes => JSON.parse(gunzipSync(bytes).toString("utf8")) as Record<string, ConsultSource>);
    loaded.set(situation, promise);
    promise.catch(() => loaded.delete(situation));
  }
  const records = await promise;
  return [...new Set(ids)].slice(0, 15).flatMap(id => {
    const source = records[id];
    return source && !isRetractedPublication(source.publicationTypes) ? [source] : [];
  });
}

/** 모델 없이 만드는 문단. 기다리는 동안과 실패했을 때 같은 것을 보여준다. */
export function evidenceFallback(
  sources: ConsultSource[],
  situation: string,
  options: { conditionLine?: string; patientContext?: string } = {},
): ComposedParagraph[] {
  return groundedFallback(sources, situation, options);
}

export function sourceText(source: ConsultSource) {
  return [source.title,source.year,source.publicationTypes,source.abstract,source.finding,source.findingKo,source.population,source.dose,source.outcome].join("\n");
}
