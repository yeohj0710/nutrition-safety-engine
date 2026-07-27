#!/usr/bin/env python3
"""Phase 02 증거 산출물의 플랫폼 독립 정규 바이트.

Windows 체크아웃에서는 `core.autocrlf` 때문에 작업 트리의 텍스트 파일이 CRLF 로
바뀐다. 원시 바이트를 그대로 해싱하면 내용이 같아도 매니페스트와 해시·크기가
어긋난다. 이 모듈은 해싱 전에 파일을 정규 형태로 바꿔 그 드리프트를 제거한다.

정규 형태
- UTF-8 BOM 제거
- CRLF 와 단독 CR 을 LF 로 통일
- 파일 끝 개행 1개 보장(빈 파일은 그대로 둔다)
- CSV 는 파싱 후 최소 인용 규칙으로 다시 직렬화해 불필요한 따옴표를 제거한다
"""

from __future__ import annotations

import csv
import hashlib
import io
from pathlib import Path

BOM = "﻿"


def _decode(source: bytes) -> str:
    text = source.decode("utf-8-sig")
    return text.replace("\r\n", "\n").replace("\r", "\n")


def canonical_text_bytes(source: bytes) -> bytes:
    """텍스트 파일의 정규 바이트를 돌려준다."""
    text = _decode(source)
    if text and not text.endswith("\n"):
        text += "\n"
    return text.encode("utf-8")


def canonical_csv_bytes(source: bytes) -> bytes:
    """CSV 파일의 정규 바이트를 돌려준다.

    개행 정규화만으로는 따옴표 사용이 다른 두 파일이 같은 표를 담고 있어도
    바이트가 달라진다. 그래서 파싱한 뒤 최소 인용 규칙으로 다시 쓴다.
    셀 안의 개행은 보존되며 LF 로 통일된다.
    """
    text = _decode(source)
    if not text.strip():
        return b""
    rows = list(csv.reader(io.StringIO(text, newline="")))
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def canonical_bytes(path: Path) -> bytes:
    """확장자에 따라 알맞은 정규화를 적용한다."""
    source = path.read_bytes()
    if path.suffix.lower() == ".csv":
        return canonical_csv_bytes(source)
    return canonical_text_bytes(source)


def canonical_sha256(path: Path) -> str:
    return hashlib.sha256(canonical_bytes(path)).hexdigest()


def canonical_size(path: Path) -> int:
    return len(canonical_bytes(path))
