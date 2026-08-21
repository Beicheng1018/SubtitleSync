from __future__ import annotations

import html
import re
import unicodedata

HTML_TAG_RE = re.compile(r"<[^>]+>")
BRACKET_NOTE_RE = re.compile(r"[\[(（【][^\])）】]{0,20}[\])）】]")
SPEAKER_RE = re.compile(r"^\s*[-ー―]+\s*|^\s*[^:：]{1,12}[:：]\s*")
WHITESPACE_RE = re.compile(r"\s+")


def clean_subtitle_text(text: str) -> str:
    """Clean SRT display text while keeping the spoken content readable."""
    text = html.unescape(text.replace("\ufeff", ""))
    text = text.replace("\\N", "\n")
    lines = []
    for raw_line in text.splitlines():
        line = HTML_TAG_RE.sub("", raw_line).strip()
        line = BRACKET_NOTE_RE.sub("", line)
        line = SPEAKER_RE.sub("", line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines).strip()


def normalize_for_match(text: str) -> str:
    text = clean_subtitle_text(text)
    text = unicodedata.normalize("NFKC", text).lower()
    text = re.sub(r"[、。！？!?…・,.，．:：;；「」『』（）()\[\]【】\-ー―~〜\s]", "", text)
    return WHITESPACE_RE.sub("", text)
