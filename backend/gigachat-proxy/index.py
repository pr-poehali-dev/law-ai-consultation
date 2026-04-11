"""
Единый API: AI-юрист (DeepSeek V3 via Yandex Cloud) + авторизация. v2 — оптимизированные промпты.
mode: "chat" | "doc_generate" | "file_analyze" | "file_cleanup"
auth actions: register, login, me, logout, update-profile, consume-question, add-paid-service
"""
import json
import os
import re
import warnings
import requests
import base64
import io
import time
import threading
import boto3
from datetime import date

from auth_handler import (
    handle_register, handle_login, handle_me,
    handle_logout, handle_update_profile,
    handle_consume_question, handle_consume_doc, handle_add_paid_service,
    handle_report, handle_send_otp, handle_verify_otp, sanitize_str,
    handle_lawyer_send, handle_lawyer_messages,
)

warnings.filterwarnings("ignore")

TODAY = date.today().strftime("%d.%m.%Y")

# ───────────────────────────────────────────────
# СИСТЕМНЫЙ ПРОМПТ — КОНСУЛЬТАЦИЯ (сжатый)
# ───────────────────────────────────────────────
SYSTEM_CHAT = f"""Ты — AI-юрист РФ (гражданское, семейное, трудовое, жилищное, административное, налоговое, процессуальное право). Дата: {TODAY}.

ПРАВИЛА:
- Каждый тезис — ссылка на статью (ст. X ГК/ТК/СК/КоАП/НК/АПК/ГПК РФ). Не пиши «по закону» — только конкретную статью.
- Не придумывай статьи и судебную практику.
- Уголовные дела: метка [УГОЛОВНАЯ ОПАСНОСТЬ], направь к адвокату.
- Запросы на составление документов: «Перейдите в раздел "Документы"».
- Нет фактов — задай 3 уточняющих вопроса.

СТРУКТУРА ОТВЕТА:
1. ПРАВОВАЯ КВАЛИФИКАЦИЯ — ключевая норма
2. ЧТО ДЕЛАТЬ — 3–5 шагов со статьями
3. РИСКИ — когда нужен юрист
4. ПЕРСПЕКТИВА — шансы, сроки (ст. 196 ГК РФ)
5. СТАТЬИ — список применённых норм

Ответ: до 600 слов, чётко и по делу."""

# ───────────────────────────────────────────────
# СИСТЕМНЫЙ ПРОМПТ — ГЕНЕРАЦИЯ ДОКУМЕНТА
# ───────────────────────────────────────────────
SYSTEM_DOC_GENERATE = f"""Ты — юрист-документовед РФ. Дата: {TODAY}.
Составь юридический документ строго по структуре. Каждый тезис — ссылка на статью закона РФ. Не придумывай статьи.

═══════════════════
БЛОКИ ДОКУМЕНТА (маркер на отдельной строке):
[ШАПКА] — кому/от кого, адрес, телефон; для исков — цена иска, госпошлина
[ЗАГОЛОВОК] — название документа ЗАГЛАВНЫМИ
[ТЕЛО] — факты хронологически, ссылки на статьи, абзацы через пустую строку
[ТРЕБОВАНИЯ] — нумерованный список требований (для исков/претензий)
[ПРИЛОЖЕНИЯ] — список документов
[ПОДПИСЬ] — ФИО, [ПОДПИСЬ], дата (справа)
[ОБОСНОВАНИЕ] — применённые статьи
[ПРИМЕЧАНИЯ] — что вписать вручную, сроки подачи

═══════════════════
СПЕЦИФИКА ПО ВИДАМ:
- Иски (ст.131–132 ГПК): цена иска прописью, госпошлина (ст.333.19 НК), подсудность (ст.28 ГПК)
- Жалобы: срок обжалования (ст.30.3 КоАП / ст.256 КАС)
- Претензии: срок ответа (ст.165.1 ГК)

═══════════════════
ДОГОВОРЫ ГПХ И КУПЛИ-ПРОДАЖИ — ОБЯЗАТЕЛЬНАЯ СТРУКТУРА:

Для договора ГПХ (гражданско-правовой характер) используй СЛЕДУЮЩУЮ СТРУКТУРУ ТОЧНО:

[ЗАГОЛОВОК]
ДОГОВОР ГРАЖДАНСКО-ПРАВОВОГО ХАРАКТЕРА (ГПХ)

[ТЕЛО]
г. [населённый пункт], «[число]» [месяц] [год] г.

[ФИО Исполнителя/Подрядчика], [дата рождения], паспорт [серия номер], выдан [кем, когда], зарегистрирован(а) по адресу: [адрес], именуемый(ая) далее «Исполнитель», с одной стороны, и [ФИО/наименование Заказчика], [реквизиты], именуемый(ая) далее «Заказчик», с другой стороны, заключили настоящий договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА
1.1. Исполнитель обязуется выполнить [описание работ/услуг], а Заказчик — принять и оплатить результат.
1.2. Срок выполнения: с [дата] по [дата].

2. ПРАВА И ОБЯЗАННОСТИ СТОРОН
2.1. Исполнитель обязан: [перечень].
2.2. Заказчик обязан: обеспечить условия, принять результат (ст. 702, 779 ГК РФ), произвести оплату.

3. СТОИМОСТЬ И ПОРЯДОК РАСЧЁТОВ
3.1. Стоимость: [сумма] рублей.
3.2. Порядок оплаты: [условия]. НДФЛ уплачивается Исполнителем самостоятельно (ст. 228 НК РФ).

4. СДАЧА И ПРИЁМКА
4.1. Исполнитель передаёт результат по акту сдачи-приёмки.
4.2. Заказчик принимает в течение [N] рабочих дней (ст. 720 ГК РФ).

5. ОТВЕТСТВЕННОСТЬ СТОРОН
5.1. За просрочку оплаты — пени [X]% за каждый день (ст. 330 ГК РФ).
5.2. За некачественное исполнение — ответственность по ст. 723 ГК РФ.

6. ПОРЯДОК РАСТОРЖЕНИЯ
6.1. Договор может быть расторгнут по соглашению сторон (ст. 450 ГК РФ) или в одностороннем порядке (ст. 782 ГК РФ).

7. КОНФИДЕНЦИАЛЬНОСТЬ
7.1. Стороны обязуются не разглашать условия договора третьим лицам.

8. РАЗРЕШЕНИЕ СПОРОВ
8.1. Споры — в суде по месту нахождения Заказчика (ст. 28 ГПК РФ).

9. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН

Для договора купли-продажи недвижимости:

[ЗАГОЛОВОК]
ДОГОВОР КУПЛИ-ПРОДАЖИ

[ТЕЛО]
г. [населённый пункт], «[число]» [месяц] [год] г.

[ФИО Покупателя], [дата рождения], паспорт серии [XX XX] №[XXXXXX] выдан [кем, когда], зарегистрирован(а) по адресу: [адрес], именуемый(ая) далее «Покупатель», с одной стороны, и [ФИО Продавца], [паспортные данные], зарегистрирован(а) по адресу: [адрес], именуемый(ая) далее «Продавец», с другой стороны, заключили настоящий договор:

1. Продавец продаёт, а Покупатель покупает:
1.1. [Описание объекта], площадь [N] кв.м., адрес: [адрес], кадастровый номер: [номер]. Принадлежит Продавцу на праве: [основание], свидетельство/запись регистрации №[N] от [дата].

2. Цена: [сумма цифрами] ([сумма прописью]) рублей. Расчёт произведён до подписания договора.

3. Продавец гарантирует: объект не продан, не заложен, под арестом не находится.

4. Настоящий договор имеет силу передаточного акта (ст. 556 ГК РФ).

5. Право залога у Продавца не возникает (ст. 488 ГК РФ).

6. Переход права собственности подлежит государственной регистрации (ст. 551 ГК РФ).

7. Право собственности у Покупателя — с момента регистрации в Росреестре.

8. Расходы по регистрации оплачивает Покупатель.

9. Договор составлен в [N] экземплярах.

10. Реквизиты сторон: [ФИО, паспорт, адрес каждой стороны]

═══════════════════
РЕКВИЗИТЫ: известные данные вставляй напрямую. Неизвестные — только метки {{{{ПОЛЕ_НАЗВАНИЕ}}}} (русский, подчёркивание). Запрещены [...] и ___.

Объём: минимум 600 слов, максимум 1200 слов. Документ должен быть полным и готовым к использованию."""

# ───────────────────────────────────────────────
# СИСТЕМНЫЙ ПРОМПТ — АНАЛИЗ ФАЙЛА (сжатый)
# ───────────────────────────────────────────────
SYSTEM_FILE_ANALYZE_PROMPT = f"""Ты — юрист РФ. Дата: {TODAY}. Проанализируй документ:
1. ТИП — вид документа
2. СТОРОНЫ — участники и их роли
3. СУТЬ — предмет и ключевые условия
4. РИСКИ — что может быть оспорено (со статьями)
5. СООТВЕТСТВИЕ — нормам РФ (ст.432 ГК для договоров, ст.131 ГПК для исков)
6. РЕКОМЕНДАЦИИ — что исправить

Каждый вывод — конкретная статья закона РФ. До 500 слов."""

# ───────────────────────────────────────────────
# Системные промпты по типам документов
# ───────────────────────────────────────────────
SYSTEM_DOC_BY_TYPE = {
    "claim": f"""Ты — юрист по гражданскому и арбитражному процессу. Составь исковое заявление строго по данным пользователя. Дата: {TODAY}.

Визуальные требования: шрифт Times New Roman 14 пт, межстрочный интервал 1.5, абзацный отступ 1.25 см, поля: левое 3 см, правое 1.5 см, верхнее 2 см, нижнее 2 см. Шапка суда и сторон — по правому краю. Слова ИСТЕЦ, ОТВЕТЧИК, ТРЕТЬЕ ЛИЦО, ПРОШУ — заглавными. Нумерация страниц — внизу по центру. Дата и подпись — в конце документа.

Структура иска:
1. Вводная часть (обстоятельства дела, даты, договоры, номера ИП и т.д.)
2. Нарушение прав истца (конкретно)
3. Правовое обоснование (ссылки на статьи ГК РФ, ГПК/АПК, № 229-ФЗ, № 127-ФЗ, постановления Пленумов ВС РФ)
4. Вывод
5. ПРОШУ (нумерованный список требований)
6. Приложение (нумерованный список документов)
7. Дата и подпись справа

Неизвестные реквизиты — метки {{{{ПОЛЕ_НАЗВАНИЕ}}}}. Запрещены [...] и ___. Объём: 400–600 слов.""",

    "pretension": f"""Ты — юрист по договорному и претензионному праву. Составь досудебную претензию строго по данным пользователя. Дата: {TODAY}.

Визуальные требования: шрифт Times New Roman 14 пт, межстрочный интервал 1.5, абзацный отступ 1.25 см, поля: левое 3 см, правое 1.5 см, верхнее 2 см, нижнее 2 см. Шапка (кому и от кого) — по правому краю. Слово ПРЕТЕНЗИЯ — по центру заглавными. Слова ОТВЕТЧИК, ЗАЯВИТЕЛЬ, ПРОШУ — заглавными. Дата и подпись — в конце.

Структура претензии:
1. Шапка: Кому (ФИО/наименование, адрес), От кого (ФИО/наименование, адрес, контакты)
2. Заголовок: ПРЕТЕНЗИЯ (по центру)
3. Вводная часть: ссылка на договор/акт/обязательство (дата, номер, суть)
4. Фактические обстоятельства: что было сделано, что нарушено, даты, суммы
5. Правовое обоснование: ссылки на статьи ГК РФ (309, 310, 330, 395, 450, 614 и т.п. — по ситуации)
6. Требование (ПРОШУ): конкретное действие — оплатить, передать, подписать, устранить недостатки
7. Срок для добровольного удовлетворения (10 или 30 календарных дней)
8. Предупреждение об обращении в суд (с указанием дополнительных расходов: госпошлина, неустойка, судебные издержки)
9. Приложение (перечень прилагаемых документов)
10. Дата и подпись справа

Неизвестные реквизиты — метки {{{{ПОЛЕ_НАЗВАНИЕ}}}}. Запрещены [...] и ___. Объём: 350–550 слов.""",

    "complaint": f"""Ты — юрист по гражданскому, арбитражному и административному процессу. Составь жалобу строго по данным пользователя. Тип жалобы определяет пользователь. Дата: {TODAY}.

Визуальные требования: шрифт Times New Roman 14 пт, межстрочный интервал 1.5, абзацный отступ 1.25 см, поля: левое 3 см, правое 1.5 см, верхнее 2 см, нижнее 2 см. Шапка суда или должностного лица — по правому краю. Слово ЖАЛОБА — по центру заглавными. Слова ЗАЯВИТЕЛЬ, ДОЛЖНОСТНОЕ ЛИЦО, ЗАИНТЕРЕСОВАННОЕ ЛИЦО, ПРОШУ — заглавными. Нумерация страниц — внизу по центру. Дата и подпись — в конце.

Для жалобы на действия/бездействие пристава (ст. 121, 122 № 229-ФЗ, ст. 218 КАС РФ): шапка — руководителю ОСП или в суд; указание на обжалуемое действие/бездействие (постановление, дата, номер); правовое обоснование (ст. 121, 122 229-ФЗ, ст. 218, 226 КАС РФ, Пленум ВС РФ № 50); ПРОШУ — признать незаконным, обязать совершить действие.

Для апелляционной/кассационной жалобы: шапка — в [суд апелляционной/кассационной инстанции]; заявитель с процессуальным статусом; доводы незаконности (нарушение норм материального/процессуального права); ПРОШУ — отменить решение.

Неизвестные реквизиты — метки {{{{ПОЛЕ_НАЗВАНИЕ}}}}. Запрещены [...] и ___. Объём: 350–550 слов.""",

    "contract": f"""Ты — юрист по договорному праву с опытом в сфере гражданско-правовых отношений. Составь договор ГПХ строго по данным пользователя. Тип договора определяет пользователь (подряд, возмездное оказание услуг, авторский заказ и т.д.). Дата: {TODAY}.

Визуальные требования: шрифт Times New Roman 14 пт, межстрочный интервал 1.5, абзацный отступ 1.25 см, поля: левое 3 см, правое 1.5 см, верхнее 2 см, нижнее 2 см. Слова ЗАКАЗЧИК, ИСПОЛНИТЕЛЬ (ПОДРЯДЧИК) — заглавными. Нумерация разделов и пунктов: 1., 1.1., 1.2., 2. и т.д. В конце — реквизиты и подписи с расшифровкой.

Структура договора ГПХ (строго соблюдать):
1. Шапка: место и дата заключения
2. Стороны (ФИО/наименование, паспортные данные/ИНН/ОГРН, адрес)
3. Раздел 1. ПРЕДМЕТ ДОГОВОРА (конкретный результат работ/услуг)
4. Раздел 2. ПРАВА И ОБЯЗАННОСТИ СТОРОН
5. Раздел 3. СРОКИ ВЫПОЛНЕНИЯ РАБОТ (начало, окончание)
6. Раздел 4. ЦЕНА ДОГОВОРА И ПОРЯДОК РАСЧЁТОВ (сумма цифрами и прописью, аванс, постоплата; НДФЛ уплачивается Исполнителем самостоятельно — ст. 228 НК РФ)
7. Раздел 5. ПОРЯДОК СДАЧИ И ПРИЁМКИ РАБОТ (акт приёма-передачи — ст. 720 ГК РФ)
8. Раздел 6. ОТВЕТСТВЕННОСТЬ СТОРОН (неустойка — ст. 330 ГК РФ; некачественное исполнение — ст. 723 ГК РФ)
9. Раздел 7. ФОРС-МАЖОР (ст. 401 ГК РФ)
10. Раздел 8. ПОРЯДОК РАСТОРЖЕНИЯ ДОГОВОРА (ст. 450, 782 ГК РФ)
11. Раздел 9. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ (кол-во экземпляров, право, досудебный порядок)
12. Раздел 10. АДРЕСА, РЕКВИЗИТЫ И ПОДПИСИ СТОРОН

ВАЖНО: договор ГПХ не должен содержать признаков трудового договора (нет должности, нет штатного расписания, нет социальных гарантий). Результат — конкретный, овеществлённый. Акт приёма-передачи — обязательное приложение.

Неизвестные реквизиты — метки {{{{ПОЛЕ_НАЗВАНИЕ}}}}. Запрещены [...] и ___. Объём: 500–700 слов.""",

    "business_contract": f"""Ты — корпоративный юрист с опытом сопровождения B2B-сделок. Составь договор для бизнеса строго по данным пользователя. Тип договора определяет пользователь (поставка, подряд, аренда, услуги, комиссия, агентский, лизинг, займ и т.д.). Дата: {TODAY}.

Визуальные требования: шрифт Times New Roman 14 пт, межстрочный интервал 1.5, абзацный отступ 1.25 см, поля: левое 3 см, правое 1.5 см, верхнее 2 см, нижнее 2 см. Наименования сторон (ПОСТАВЩИК, ПОКУПАТЕЛЬ, АРЕНДОДАТЕЛЬ и т.п.) — заглавными. Наименование договора — по центру заглавными. Нумерация разделов: 1., 1.1., 1.2., 2. В конце — юридические адреса, банковские реквизиты, подписи с расшифровкой и печать.

Структура (адаптировать под тип договора):
1. Шапка: место, дата, номер договора
2. Стороны (полное наименование, ОГРН, ИНН, КПП, юр. адрес, ФИО руководителя, Устав/доверенность)
3. Раздел 1. ПРЕДМЕТ ДОГОВОРА (что передаётся/выполняется/оказывается, кол-во, качество, объём)
4. Раздел 2. ЦЕНА И ПОРЯДОК РАСЧЁТОВ (сумма цифрами и прописью; предоплата/постоплата; НДС — «в т.ч. НДС 20%» или «НДС не облагается»; ответственность за просрочку)
5. Раздел 3. ПРАВА И ОБЯЗАННОСТИ СТОРОН
6. Раздел 4. СРОКИ И УСЛОВИЯ ПОСТАВКИ/ВЫПОЛНЕНИЯ (переход права собственности и рисков)
7. Раздел 5. ПОРЯДОК ПРИЁМКИ (акт/УПД/ТОРГ-12/КС-2; порядок выявления недостатков, рекламации)
8. Раздел 6. ОТВЕТСТВЕННОСТЬ СТОРОН (неустойка — размер и порядок; ограничение ответственности)
9. Раздел 7. ФОРС-МАЖОР (перечень, уведомление, последствия)
10. Раздел 8. КОНФИДЕНЦИАЛЬНОСТЬ (при необходимости)
11. Раздел 9. ПОРЯДОК РАСТОРЖЕНИЯ (основания, уведомление, последствия)
12. Раздел 10. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ (кол-во экземпляров, право, претензионный порядок — срок ответа 10–30 дней, подсудность)
13. Раздел 11. АДРЕСА, РЕКВИЗИТЫ И ПОДПИСИ СТОРОН (юр./факт. адрес, БИК, р/с, к/с, телефон, email, подпись с расшифровкой, печать)

ВАЖНО: чёткое определение предмета (без «иные услуги»); претензионный порядок обязателен; подсудность — арбитражный суд; договор считается заключённым с момента подписания.

Неизвестные реквизиты — метки {{{{ПОЛЕ_НАЗВАНИЕ}}}}. Запрещены [...] и ___. Объём: 600–800 слов.""",
}

# ───────────────────────────────────────────────
# Промпты для первого сообщения в диалоге
# ───────────────────────────────────────────────
DOC_STARTERS = {
    "claim": "Помогу подготовить исковое заявление. Для начала расскажите: кто подаёт иск и против кого? Укажите ФИО (или название организации) и адреса обеих сторон.",
    "pretension": "Помогу составить досудебную претензию. Для начала: кто направляет претензию и кому? Укажите ФИО/название и адреса обеих сторон.",
    "complaint": "Помогу подготовить жалобу в Роспотребнадзор. Для начала: ваши ФИО и адрес регистрации, а также название и адрес организации, на которую жалуетесь.",
    "contract": "Помогу составить договор ГПХ. Для начала: данные Заказчика — ФИО (или название организации), адрес, ИНН. Кто будет второй стороной — физлицо или ИП?",
    "business_contract": "Помогу подготовить коммерческий договор. Для начала: данные первой стороны — название организации, ИНН, юридический адрес, ФИО и должность руководителя.",
}

# Маркеры отказа YandexGPT
REFUSAL_MARKERS = [
    "не могу обсуждать",
    "не могу помочь",
    "не в состоянии",
    "давайте поговорим о чём",
    "предлагаю сменить тему",
    "не буду обсуждать",
    "нет возможности",
    "не предназначен для",
]

# URI модели: берём из переменной окружения (можно менять без деплоя),
# либо используем YandexGPT по умолчанию.
YANDEX_MODEL = os.environ.get("YANDEX_MODEL_URI", "gpt://b1gd8kncmd8nf4j7h770/deepseek-v32/latest")

# SYSTEM_FILE_ANALYZE теперь SYSTEM_FILE_ANALYZE_PROMPT (определён выше вместе с остальными)

# ───────────────────────────────────────────────
# S3 и файловые утилиты
# ───────────────────────────────────────────────
FILE_TTL = 1800  # 30 минут
FILE_BUCKET = "files"
FILE_PREFIX = "temp-docs/"
MAX_FILE_MB = 10
ALLOWED_EXTS = {"pdf", "docx", "doc", "jpeg", "jpg", "png"}


def get_s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def save_temp_file(s3, data: bytes, filename: str, content_type: str) -> str:
    ts = int(time.time())
    key = f"{FILE_PREFIX}{ts}_{filename}"
    s3.put_object(Bucket=FILE_BUCKET, Key=key, Body=data, ContentType=content_type,
                  Metadata={"uploaded_at": str(ts)})
    return key


def cleanup_temp_files(s3) -> list:
    deleted = []
    now = int(time.time())
    try:
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=FILE_BUCKET, Prefix=FILE_PREFIX):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                basename = key.replace(FILE_PREFIX, "")
                parts = basename.split("_", 1)
                try:
                    uploaded_at = int(parts[0])
                    if now - uploaded_at >= FILE_TTL:
                        s3.delete_object(Bucket=FILE_BUCKET, Key=key)
                        deleted.append(key)
                except (ValueError, IndexError):
                    pass
    except Exception:
        pass
    return deleted


def extract_pdf_text(data: bytes) -> str:
    import PyPDF2
    reader = PyPDF2.PdfReader(io.BytesIO(data))
    pages = [p.extract_text() or "" for p in reader.pages[:20]]
    return "\n".join(pages).strip()


def extract_docx_text(data: bytes) -> str:
    from docx import Document as DocxDocument
    doc = DocxDocument(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())[:12000]


def _call_openai_compat(messages: list, max_tokens: int, temperature: float = 0.1) -> str:
    """Вызов через OpenAI-совместимый API Яндекса (DeepSeek и др.)."""
    iam_token = os.environ["YANDEX_IAM_TOKEN"].strip()
    resp = requests.post(
        "https://llm.api.cloud.yandex.net/v1/chat/completions",
        headers={"Authorization": f"Api-Key {iam_token}", "Content-Type": "application/json"},
        json={
            "model": YANDEX_MODEL,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        },
        timeout=180,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def analyze_file_with_yandex(text: str, comment: str, iam_token: str) -> str:
    user_content = f"Вопрос: {comment}\n\n" if comment else ""
    user_content += f"Документ:\n\n{text[:8000]}"  # 8000 вместо 10000 — быстрее
    return _call_openai_compat(
        messages=[
            {"role": "system", "content": SYSTEM_FILE_ANALYZE_PROMPT},
            {"role": "user", "content": user_content},
        ],
        max_tokens=1200,
        temperature=0.1,
    )


CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}


def is_refusal(text: str) -> bool:
    low = text.lower()
    return any(m in low for m in REFUSAL_MARKERS)


MAX_HISTORY = 6  # Последние 6 сообщений — достаточно для контекста, меньше токенов на входе


def call_yandex(system_prompt: str, messages: list, max_tokens: int = 1200) -> str:
    # Берём только последние MAX_HISTORY сообщений — сокращает входной контекст
    recent = messages[-MAX_HISTORY:] if len(messages) > MAX_HISTORY else messages
    openai_messages = [{"role": "system", "content": system_prompt}] + [
        {
            "role": "user" if m.get("role") == "user" else "assistant",
            "content": m.get("content", m.get("text", "")),
        }
        for m in recent
    ]
    return _call_openai_compat(openai_messages, max_tokens)


def handler(event: dict, context) -> dict:
    """AI-юрист (DeepSeek V3) + авторизация. Режимы: chat, doc_chat, doc_generate."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    headers = event.get("headers") or {}
    token = headers.get("X-Auth-Token") or headers.get("x-auth-token", "")

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    # --- Базовая защита: санитизация action ---
    action = sanitize_str(body.get("action") or "", max_len=64)

    # --- Auth ---
    ip = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp", "")

    # Для мессенджера нужен user_id и is_admin — резолвим заранее
    _me_cached = None
    def _get_me():
        nonlocal _me_cached
        if _me_cached is None:
            _me_cached = handle_me(token)
        return _me_cached

    def _lawyer_send_action():
        me = _get_me()
        if "error" in me: return me
        u = me.get("data", {})
        return handle_lawyer_send(body, u["id"], u.get("isAdmin", False))

    def _lawyer_messages_action():
        me = _get_me()
        if "error" in me: return me
        u = me.get("data", {})
        return handle_lawyer_messages(body, u["id"], u.get("isAdmin", False))

    auth_actions = {
        "register": lambda: handle_register(body),
        "login": lambda: handle_login(body, ip),
        "me": lambda: handle_me(token),
        "logout": lambda: handle_logout(token),
        "update-profile": lambda: handle_update_profile(token, body),
        "consume-question": lambda: handle_consume_question(token),
        "consume-doc": lambda: handle_consume_doc(token),
        "add-paid-service": lambda: handle_add_paid_service(token, body),
        "report": lambda: handle_report(token, body),
        "send-otp": lambda: handle_send_otp(body),
        "verify-otp": lambda: handle_verify_otp(body),
        "lawyer-send": _lawyer_send_action,
        "lawyer-messages": _lawyer_messages_action,
    }
    if action in auth_actions:
        result = auth_actions[action]()
        status = result.get("status", 200)
        if "error" in result:
            return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"error": result["error"]}, ensure_ascii=False)}
        return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps(result.get("data", {}), ensure_ascii=False)}

    # --- AI ---
    try:
        mode = body.get("mode", "chat")

        # ── Генерация документа из описания пользователя ──
        if mode == "doc_generate":
            doc_type = body.get("doc_type", "claim")
            details = body.get("details", "").strip()
            if not details:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "details required"})}
            doc_labels = {
                "claim": "исковое заявление",
                "pretension": "досудебную претензию",
                "complaint": "жалобу",
                "contract": "договор ГПХ",
                "business_contract": "коммерческий договор",
            }
            label = doc_labels.get(doc_type, "документ")
            # Используем специализированный промпт для каждого типа
            system_prompt = SYSTEM_DOC_BY_TYPE.get(doc_type, SYSTEM_DOC_GENERATE)
            prompt = (
                f"Составь {label} на основании следующего описания ситуации:\n\n{details}\n\n"
                f"Там где не хватает конкретных данных (ФИО, адрес, ИНН и т.д.) — "
                f"используй метки-заглушки {{{{ПОЛЕ_НАЗВАНИЕ}}}} (русский язык, подчёркивание). "
                f"Запрещены [...] и ___."
            )
            answer = call_yandex(system_prompt, [{"role": "user", "content": prompt}], max_tokens=2200)
            # Определяем обрыв: заканчивается без подписи/реквизитов
            truncated = not bool(re.search(r'(подпись|реквизиты|экземпляр|дата\s*[:|]?\s*«|\d{1,2}\.\d{2}\.\d{4})', answer[-300:], re.I))
            placeholders = list(dict.fromkeys(re.findall(r'\{\{([^}]+)\}\}', answer)))
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer, "placeholders": placeholders, "truncated": truncated}, ensure_ascii=False)}

        # ── Продолжение обрезанного документа ──
        elif mode == "doc_continue":
            doc_type = body.get("doc_type", "claim")
            partial = body.get("partial", "").strip()
            if not partial:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "partial required"})}
            system_prompt = SYSTEM_DOC_BY_TYPE.get(doc_type, SYSTEM_DOC_GENERATE)
            # Берём последние ~800 символов как контекст
            context_tail = partial[-800:]
            prompt = (
                f"Документ был обрезан. Продолжи с того места, где остановился, без повторения уже написанного.\n\n"
                f"Конец уже написанного текста:\n...{context_tail}\n\n"
                f"Продолжай документ до финального блока с реквизитами, подписями и датой. "
                f"Незаполненные поля — метки {{{{ПОЛЕ_НАЗВАНИЕ}}}}."
            )
            answer = call_yandex(system_prompt, [{"role": "user", "content": prompt}], max_tokens=2500)
            truncated = not bool(re.search(r'(подпись|реквизиты|экземпляр|дата\s*[:|]?\s*«|\d{1,2}\.\d{2}\.\d{4})', answer[-300:], re.I))
            placeholders = list(dict.fromkeys(re.findall(r'\{\{([^}]+)\}\}', answer)))
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer, "placeholders": placeholders, "truncated": truncated}, ensure_ascii=False)}

        # ── Анализ загруженного файла ──
        elif mode == "file_analyze":
            file_b64 = body.get("file", "")
            filename = body.get("filename", "document")
            comment = body.get("comment", "").strip()

            if not file_b64:
                return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": "file required"}, ensure_ascii=False)}

            file_data = base64.b64decode(file_b64)
            if len(file_data) > MAX_FILE_MB * 1024 * 1024:
                return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": f"Файл слишком большой. Максимум {MAX_FILE_MB} МБ."}, ensure_ascii=False)}

            ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            if ext not in ALLOWED_EXTS:
                return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                        "body": json.dumps({"error": f"Формат .{ext} не поддерживается. Допустимые: PDF, DOCX, DOC, JPEG, JPG, PNG."}, ensure_ascii=False)}

            mime_map = {"pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "doc": "application/msword", "jpeg": "image/jpeg", "jpg": "image/jpeg", "png": "image/png"}
            content_type = mime_map.get(ext, "application/octet-stream")

            # Сохраняем в S3; очистку старых файлов запускаем в фоне (не блокирует ответ)
            s3 = get_s3()
            s3_key = save_temp_file(s3, file_data, filename, content_type)
            threading.Thread(target=cleanup_temp_files, args=(s3,), daemon=True).start()

            # Извлекаем текст
            if ext == "pdf":
                text = extract_pdf_text(file_data)
            elif ext in ("docx", "doc"):
                text = extract_docx_text(file_data)
            else:
                # Для изображений передаём base64 напрямую в промпт как описание
                text = f"[Изображение формата {ext.upper()}. Анализируй как юридический документ на фото.]"

            iam_token = os.environ["YANDEX_IAM_TOKEN"].strip()
            answer = analyze_file_with_yandex(text, comment, iam_token)

            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer, "filename": filename,
                                        "delete_at": int(time.time()) + FILE_TTL}, ensure_ascii=False)}

        # ── Очистка временных файлов (вызывается по крону или вручную) ──
        elif mode == "file_cleanup":
            s3 = get_s3()
            deleted = cleanup_temp_files(s3)
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"deleted": len(deleted), "keys": deleted}, ensure_ascii=False)}

        # ── Продолжение обрезанного ответа в чате ──
        elif mode == "chat_continue":
            messages = body.get("messages", [])
            partial = body.get("partial", "").strip()
            if not partial:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "partial required"})}
            # Добавляем в историю частичный ответ и просим продолжить
            cont_messages = list(messages) + [
                {"role": "assistant", "content": partial},
                {"role": "user", "content": "Продолжи ответ с того места, где остановился. Не повторяй уже написанное."},
            ]
            answer = call_yandex(SYSTEM_CHAT, cont_messages, max_tokens=1200)
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer}, ensure_ascii=False)}

        # ── Обычный чат-консультация ──
        else:
            messages = body.get("messages", [])
            if not messages:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "messages required"})}
            answer = call_yandex(SYSTEM_CHAT, messages, max_tokens=1800)
            # Эвристика обрыва: ответ заканчивается не на знак препинания/раздел
            truncated = len(answer) > 200 and not bool(re.search(r'[.!?»\d]\s*$', answer.rstrip()))
            return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                    "body": json.dumps({"answer": answer, "truncated": truncated}, ensure_ascii=False)}

    except Exception as e:
        if hasattr(e, "response") and e.response is not None:
            code = e.response.status_code
            try:
                detail = e.response.json()
            except Exception:
                detail = e.response.text[:300]
            return {"statusCode": 502, "headers": CORS,
                    "body": json.dumps({"error": f"HTTP {code}: {detail}"}, ensure_ascii=False)}
        return {"statusCode": 500, "headers": CORS, "body": json.dumps({"error": str(e)})}