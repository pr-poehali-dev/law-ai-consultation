"""Генерирует VAPID ключи в PEM формате (для pywebpush) и тестирует push."""
import json, os

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p57945357_law_ai_consultation")

def handler(event: dict, context) -> dict:
    """Генерация новых VAPID ключей в правильном формате для pywebpush."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": {"Access-Control-Allow-Origin": "*"}, "body": ""}

    try:
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives.serialization import (
            Encoding, PublicFormat, PrivateFormat, NoEncryption
        )
        import base64

        private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
        public_key = private_key.public_key()

        # Public key — uncompressed point base64url (для браузера applicationServerKey)
        pub_bytes = public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
        pub_b64 = base64.urlsafe_b64encode(pub_bytes).rstrip(b"=").decode()

        # Private key — PEM (именно этот формат нужен pywebpush)
        priv_pem = private_key.private_bytes(Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption())
        priv_pem_str = priv_pem.decode()

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
            "body": json.dumps({"publicKey": pub_b64, "privateKeyPEM": priv_pem_str}),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)}),
        }
