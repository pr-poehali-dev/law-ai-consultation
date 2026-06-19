"""Генерирует правильные VAPID ключи (raw base64url) и тестирует push."""
import json, os, psycopg2, base64

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=8, options="-c statement_timeout=15000")

def handler(event: dict, context) -> dict:
    """Генерация VAPID ключей в raw base64url формате (pywebpush совместимый)."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": {"Access-Control-Allow-Origin": "*"}, "body": ""}

    try:
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

        private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
        public_key = private_key.public_key()

        # Public key — uncompressed point base64url (для applicationServerKey в браузере)
        pub_bytes = public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
        pub_b64 = base64.urlsafe_b64encode(pub_bytes).rstrip(b"=").decode()

        # Private key — raw D value base64url (именно это ждёт pywebpush)
        priv_numbers = private_key.private_numbers()
        d_bytes = priv_numbers.private_value.to_bytes(32, "big")
        priv_b64 = base64.urlsafe_b64encode(d_bytes).rstrip(b"=").decode()

        # Тест: пробуем использовать новый ключ для push
        from pywebpush import webpush
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT id, endpoint, p256dh, auth FROM {SCHEMA}.push_subscriptions WHERE auth != 'expired' ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
        cur.close()
        conn.close()

        push_test = None
        if row:
            sub_id, endpoint, p256dh, auth = row
            try:
                webpush(
                    subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
                    data=json.dumps({"title": "🚀 Push работает!", "body": "Тест успешен — уведомления настроены.", "url": "/cabinet?tab=expert"}),
                    vapid_private_key=priv_b64,
                    vapid_claims={"sub": "mailto:ilya.povarchuk@mail.ru"},
                    timeout=10,
                )
                push_test = "ok"
            except Exception as e:
                push_test = f"fail: {str(e)[:200]}"

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
            "body": json.dumps({
                "newPublicKey": pub_b64,
                "newPrivateKey": priv_b64,
                "push_test_with_new_key": push_test,
                "note": "Вставьте эти ключи в секреты VAPID_PUBLIC_KEY и VAPID_PRIVATE_KEY"
            }),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)[:400]}),
        }
