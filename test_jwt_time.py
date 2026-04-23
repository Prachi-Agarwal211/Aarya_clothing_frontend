import jwt
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
SECRET = "test_secret_key_at_least_32_chars_long_12345"
ALGO = "HS256"

def now_ist():
    return datetime.now(IST)

# Scenario A: Use aware IST datetime
exp_ist = now_ist() + timedelta(minutes=30)
iat_ist = now_ist()
payload_ist = {
    "sub": "123",
    "exp": exp_ist,
    "iat": iat_ist
}

token_ist = jwt.encode(payload_ist, SECRET, algorithm=ALGO)
decoded_ist = jwt.decode(token_ist, SECRET, algorithms=[ALGO])

print(f"Current UTC: {datetime.now(timezone.utc)}")
print(f"Current IST: {now_ist()}")
print(f"Payload exp (IST aware): {exp_ist}")
print(f"Decoded exp (UTC timestamp): {datetime.fromtimestamp(decoded_ist['exp'], tz=timezone.utc)}")

# Scenario B: Manual check like in token_validator.py
now_utc_ts = datetime.now(timezone.utc).timestamp()
if now_utc_ts > decoded_ist['exp']:
    print("!!! Token considered EXPIRED by manual check")
else:
    print("Token is VALID by manual check")
