"""
Проверяет статус платежа в Robokassa по inv_id.
Использует XML-интерфейс Robokassa: OpStateExt.
Подпись: MD5(MrchLogin:InvId:Password2)
Также проверяет статус в нашей БД (orders).
"""
import json
import os
import hashlib
import requests
import xml.etree.ElementTree as ET
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")
ROBOKASSA_XML_URL = "https://merchant.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def check_robokassa_status(login: str, inv_id: int, password2: str) -> dict:
    """Запрашивает статус через XML API Robokassa."""
    raw = f"{login}:{inv_id}:{password2}"
    signature = hashlib.md5(raw.encode("utf-8")).hexdigest().upper()

    resp = requests.get(
        ROBOKASSA_XML_URL,
        params={
            "MerchantLogin": login,
            "InvoiceID": str(inv_id),
            "Signature": signature,
        },
        timeout=10,
    )
    resp.raise_for_status()

    root = ET.fromstring(resp.text)
    ns = {"rk": "http://merchant.roboxchange.com/WebService/"}

    # Статус кода
    state_code_el = root.find(".//rk:State/rk:Code", ns)
    state_code = int(state_code_el.text) if state_code_el is not None else -1

    # 5 = оплачен (Completed)
    # 3 = в процессе (InProcess)
    # 0 = только создан
    paid = state_code == 5

    return {"state_code": state_code, "paid": paid}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    params = event.get("queryStringParameters") or {}
    inv_id_str = params.get("inv_id", "")

    if not inv_id_str:
        return {
            "statusCode": 400,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": "inv_id required"}),
        }

    try:
        inv_id = int(inv_id_str)
    except ValueError:
        return {
            "statusCode": 400,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": "inv_id must be integer"}),
        }

    # Сначала смотрим в нашей БД — самый быстрый способ
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT status, service_type, user_id FROM {SCHEMA}.orders WHERE inv_id = %s",
            (inv_id,)
        )
        row = cur.fetchone()
    finally:
        cur.close()
        conn.close()

    if row:
        db_status, service_type, user_id = row
        if db_status == "paid":
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "application/json"},
                "body": json.dumps({
                    "inv_id": inv_id,
                    "paid": True,
                    "status": "paid",
                    "service_type": service_type,
                    "user_id": user_id,
                }, ensure_ascii=False),
            }

    # Если в БД ещё не paid — запрашиваем у Robokassa напрямую
    login = os.environ["ROBOKASSA_LOGIN"]
    password2 = os.environ["ROBOKASSA_PASS2"]

    try:
        rk = check_robokassa_status(login, inv_id, password2)
        paid = rk["paid"]
        state_code = rk["state_code"]
    except Exception as e:
        # Не удалось проверить у Robokassa — возвращаем статус из БД
        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({
                "inv_id": inv_id,
                "paid": False,
                "status": db_status if row else "not_found",
                "service_type": service_type if row else None,
            }, ensure_ascii=False),
        }

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({
            "inv_id": inv_id,
            "paid": paid,
            "state_code": state_code,
            "status": "paid" if paid else "pending",
            "service_type": service_type if row else None,
        }, ensure_ascii=False),
    }
