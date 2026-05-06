"""
Лёгкая функция авторизации — прокси к gigachat-proxy только для auth-actions.
Таймаут: 12 секунд (vs 30с у gigachat-proxy). Экономит compute_seconds на auth-запросах.
Не содержит AI-логики — только пробрасывает запросы авторизации.
"""
import json
import os
import requests

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-User-Id",
    "Access-Control-Max-Age": "86400",
}

# URL основной функции — берётся из переменной окружения или env
GIGACHAT_URL = os.environ.get("GIGACHAT_PROXY_URL", "https://functions.poehali.dev/90763f33-42e3-458e-9106-b6f70af45e17")

# Auth-actions которые мы принимаем (AI-режимы сюда НЕ входят)
AUTH_ACTIONS = {
    "register", "login", "me", "logout", "update-profile",
    "consume-question", "consume-doc", "refund-doc", "add-paid-service",
    "report", "my-reports", "admin-reports",
    "send-otp", "verify-otp", "forgot-password", "change-password",
    "lawyer-send", "lawyer-messages", "lawyer-close-dialog",
    "lawyer-complete-service", "lawyer-upload-file", "lawyer-cleanup-files",
    "business-update-org", "business-consume-action",
    "business-messages-get", "business-messages-save",
    "get-billing-log", "list-users", "get-all-billing-log", "get-new-users",
    "admin-grant", "admin-search-user",
    "push-subscribe", "push-subscribe-anon", "vapid-public-key",
    "get-compute-stats", "legal-docs",
}

_session = requests.Session()


def handler(event: dict, context) -> dict:
    """Прокси авторизации с таймаутом 12с. AI-запросы идут напрямую в gigachat-proxy."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if event.get("httpMethod") == "GET":
        return {"statusCode": 200, "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"ok": True, "service": "auth-handler"})}

    if not GIGACHAT_URL:
        return {"statusCode": 503, "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"error": "Сервис временно недоступен"})}

    # Парсим body чтобы проверить action
    raw_body = event.get("body") or ""
    try:
        body = json.loads(raw_body) if raw_body else {}
    except Exception:
        body = {}

    action = str(body.get("action") or "")[:64]
    if action not in AUTH_ACTIONS:
        return {"statusCode": 400, "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"error": f"Unknown action: {action}"})}

    # Пробрасываем токен из заголовков
    in_headers = event.get("headers") or {}
    token = in_headers.get("X-Auth-Token") or in_headers.get("x-auth-token", "")

    proxy_headers = {"Content-Type": "application/json"}
    if token:
        proxy_headers["X-Auth-Token"] = token

    try:
        resp = _session.post(
            GIGACHAT_URL,
            headers=proxy_headers,
            data=raw_body,
            timeout=11,  # немного меньше таймаута функции (12с)
        )
        return {
            "statusCode": resp.status_code,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": resp.text,
        }
    except requests.Timeout:
        return {"statusCode": 504, "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"error": "Превышено время ожидания. Попробуйте ещё раз."})}
    except Exception as e:
        return {"statusCode": 502, "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({"error": "Сервис временно недоступен"})}