"""Роутинг doc_type → системный промпт из блочных файлов."""
import os
import sys

_DIR = os.path.dirname(__file__)
_PROXY_DIR = os.path.join(_DIR, "..", "gigachat-proxy")
if _PROXY_DIR not in sys.path:
    sys.path.insert(0, _PROXY_DIR)

from prompts import BLOCK_BY_DOC_TYPE, ALL_SUBTYPES
from prompts import (
    SYSTEM_DOC_BY_TYPE, SYSTEM_DOC_GENERATE, LEGAL_QUALITY_ADDON
)


def get_system_prompt_for_doc(doc_type: str) -> str:
    """Возвращает системный промпт для doc_type: сначала блочные файлы, потом старый SYSTEM_DOC_BY_TYPE."""
    if doc_type in BLOCK_BY_DOC_TYPE:
        subtype_hint = ALL_SUBTYPES.get(doc_type, "")
        return (
            BLOCK_BY_DOC_TYPE[doc_type]
            + f"\n\nТип документа: {subtype_hint}"
            + "\n\n"
            + LEGAL_QUALITY_ADDON
        )
    return SYSTEM_DOC_BY_TYPE.get(doc_type, SYSTEM_DOC_GENERATE) + "\n\n" + LEGAL_QUALITY_ADDON


def get_doc_label(doc_type: str) -> str:
    """Человекочитаемое название документа по doc_type."""
    if doc_type in ALL_SUBTYPES:
        return ALL_SUBTYPES[doc_type]
    labels = {
        "claim":            "исковое заявление",
        "pretension":       "досудебную претензию",
        "complaint":        "жалобу",
        "application":      "заявление/ходатайство",
        "notification":     "уведомление",
        "contract":         "договор ГПХ",
        "court_speech":     "судебную речь",
        "response_to_claim": "отзыв на иск",
        "objection":        "возражение",
        "appeal":           "апелляционную жалобу",
        "cassation":        "кассационную жалобу",
        "supervisory":      "надзорную жалобу",
    }
    return labels.get(doc_type, "документ")
