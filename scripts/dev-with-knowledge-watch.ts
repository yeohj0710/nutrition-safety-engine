import path from "node:path";
import { spawn } from "node:child_process";
import { watch } from "node:fs";

import { writeKnowledgeIndex } from "@/src/lib/knowledge/normalize";

const projectRoot = path.resolve(__dirname, "..");
// build-knowledge-index.ts 와 같은 입력·출력을 써야 한다. 기본값(data/)을 쓰면
// data/source_registry.json 을 찾다가 매번 ENOENT 로 실패한다.
const legacyRoot = path.join(
  projectRoot,
  "data",
  "legacy_unverified",
  "baseline-33658e3",
);
const knowledgeIndexOutputPath = path.join(
  projectRoot,
  "src",
  "generated",
  "legacy",
  "knowledge-index.json",
);
const legacyRelative = path.join(
  "data",
  "legacy_unverified",
  "baseline-33658e3",
);
const watchedRelativePaths = new Set([
  path.join(legacyRelative, "knowledge_pack.json"),
  path.join(legacyRelative, "source_registry.json"),
  path.join(legacyRelative, "ingredients.json"),
  path.join(legacyRelative, "evidence_chunks.json"),
  path.join(legacyRelative, "safety_rules.json"),
]);

let pendingTimer: NodeJS.Timeout | null = null;
let rebuildInFlight = false;
let rebuildQueued = false;

async function rebuildKnowledgeIndex(reason: string) {
  if (rebuildInFlight) {
    rebuildQueued = true;
    return;
  }

  rebuildInFlight = true;

  try {
    const knowledgeIndex = await writeKnowledgeIndex(projectRoot, {
      dataRoot: legacyRoot,
      outputPath: knowledgeIndexOutputPath,
    });
    console.log(
      `[knowledge-watch] ${reason}: ${knowledgeIndex.meta.safetyRuleCount} rules, ${knowledgeIndex.meta.evidenceChunkCount} evidence chunks`,
    );
  } catch (error) {
    console.error("[knowledge-watch] failed to rebuild knowledge index");
    console.error(error);
  } finally {
    rebuildInFlight = false;

    if (rebuildQueued) {
      rebuildQueued = false;
      void rebuildKnowledgeIndex("queued update");
    }
  }
}

function scheduleRebuild(reason: string) {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
  }

  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    void rebuildKnowledgeIndex(reason);
  }, 150);
}

function startWatchers() {
  return [
    watch(legacyRoot, (_eventType, filename) => {
      if (!filename) {
        scheduleRebuild("legacy snapshot changed");
        return;
      }

      const relativePath = path.join(legacyRelative, filename.toString());

      if (!watchedRelativePaths.has(relativePath)) {
        return;
      }

      scheduleRebuild(`${relativePath} changed`);
    }),
  ];
}

async function main() {
  await rebuildKnowledgeIndex("initial build");

  const watchers = startWatchers();
  const nextCliPath = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
  const nextArgs = [nextCliPath, "dev", ...process.argv.slice(2)];
  const child = spawn(process.execPath, nextArgs, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: false,
  });

  const shutdown = () => {
    for (const watcher of watchers) {
      watcher.close();
    }

    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }

    if (!child.killed) {
      child.kill("SIGINT");
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  child.on("exit", (code, signal) => {
    shutdown();

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
