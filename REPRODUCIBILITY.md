# Reproducibility checkpoint

This repository currently proves audit isolation and proxy-pipeline behavior, not completed clinical evidence synthesis.

## Software boundary

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

## Research gates

```powershell
python tools/validate_phase01.py
python tools/validate_phase02.py
python tools/validate_phase03_proxy.py
python tools/validate_phase04_proxy.py
python tools/phase05_proxy_metrics.py
python tools/validate_phase06_gate.py
```

Phase 02–08 remain externally blocked. Proxy outputs cannot replace human decisions.

## Local-only payloads

Raw PubMed XML (`research/searches/*/pubmed/*/efetch_*.xml`) and abstract-rich `data/interim/records.csv` are intentionally ignored by Git. Their hashes and sizes are listed in `research/checkpoint_manifest.json`. Preserve them with the submission workspace.

Original G: research files are represented by a preserved 513-file hash audit because the current sandbox cannot re-open that drive.
