import json
import os
from datetime import datetime

ALERT_FILE = "alerts.json"


def _load_all():
    if not os.path.exists(ALERT_FILE):
        return []
    with open(ALERT_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def _save_all(data):
    with open(ALERT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def save_alert(alert):
    data = _load_all()
    alert["created_at"] = datetime.utcnow().isoformat() + "Z"
    data.append(alert)
    _save_all(data)


def get_alerts():
    return _load_all()
