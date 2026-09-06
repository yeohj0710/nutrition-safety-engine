"""Bind reviewed core eligibility and finding excerpts to their source text."""
from functools import lru_cache
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
REVIEW = ROOT / "research" / "final" / "evidence-review.json"


def content_sha(row: dict) -> str:
    return hashlib.sha256((row['title']+'\0'+row['abstract']).encode('utf-8')).hexdigest()


@lru_cache(maxsize=1)
def index() -> dict:
    payload = json.loads(REVIEW.read_text(encoding='utf-8'))
    if payload.get('model') != 'gpt-5.6-luna':
        raise ValueError('Unexpected core evidence reviewer')
    rows = payload['results']
    result = {(r['question_id'],r['record_id']):r for r in rows}
    if len(result) != len(rows):
        raise ValueError('Duplicate core evidence review identity')
    return result


def reviewed(row: dict) -> dict | None:
    result = index().get((row['question_id'],row['record_id']))
    if result and result['content_sha256'] != content_sha(row):
        raise ValueError(f"Core evidence source changed: {row['record_id']}")
    return result


def core_eligible(row: dict) -> bool:
    result = reviewed(row)
    return bool(result and result['core_eligible'] and result['decision']=='retain')


def finding(row: dict, sentences: list[str]) -> tuple[str,str] | None:
    result = reviewed(row)
    replacement = result.get('finding_override') if result else None
    if not replacement:
        return None
    if replacement not in sentences:
        raise ValueError(f"Reviewed finding is not an exact source sentence: {row['record_id']}")
    return f"ABSTRACT_SENTENCE_{sentences.index(replacement)+1}", replacement
