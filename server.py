#!/usr/bin/env python3
"""
VélourCare Ortho — Clinical Case Report Manager & Sync Server
Features SQLite persistence, REST API, Image Uploads, Cloudflare Tunnel,
Automated Daily Backups, and Seed Data from WA-026 Clinical Case.
"""

import http.server
import socketserver
import webbrowser
import os
import sys
import threading
import time
import json
import sqlite3
import hashlib
import secrets
import subprocess
import re
import urllib.parse
import shutil
from datetime import datetime

# Windows console UTF-8 safeguard
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
BACKUP_DIR = os.path.join(DATA_DIR, 'backups')
UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')
BIN_DIR = os.path.join(BASE_DIR, 'bin')
CLOUDFLARED_BIN = os.path.join(BIN_DIR, 'cloudflared.exe')
DB_PATH = os.path.join(DATA_DIR, 'cases.db')
URL_FILE = os.path.join(DATA_DIR, 'public_url.txt')

VIEWER_DIR = os.path.join(r"D:\Antigravity\velourcare-3d-viewer", "public")
VIEWER_CASES_DIR = os.path.join(r"D:\Antigravity\velourcare-3d-viewer", "cases")
NATIVE_ONYX_VIEWER_DIR = r"D:\Antigravity\treatmentplan_viewer"

PREFERRED_PORT = 8010
DEFAULT_PIN = "2026"

TUNNEL_URL = None
TUNNEL_PROCESS = None
from pathlib import Path
sys.path.insert(0, r"D:\Antigravity")

PROCESSED_IIWGL_MTIMES = {}

def ensure_iiwgl_ready(fpath):
    try:
        p = Path(fpath)
        if not p.is_file() or p.suffix.lower() != '.iiwgl':
            return
        mtime = p.stat().st_mtime
        if PROCESSED_IIWGL_MTIMES.get(str(p)) == mtime:
            return
        from fix_attachments import attach_attachments_to_teeth
        attach_attachments_to_teeth(str(p), None)
        PROCESSED_IIWGL_MTIMES[str(p)] = p.stat().st_mtime
        print(f"[server.py] Auto-verified and adjusted 3D attachments for {p.name}")
    except Exception as ex:
        pass

os.makedirs(BACKUP_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Database Management (SQLite)
# ---------------------------------------------------------------------------
def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    return conn

def hash_pin(pin: str, salt: str = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + pin).encode('utf-8')).hexdigest()
    return hashed, salt

def verify_pin(pin: str, hashed: str, salt: str) -> bool:
    import hmac
    expected, _ = hash_pin(pin, salt)
    return hmac.compare_digest(expected.encode('utf-8'), hashed.encode('utf-8'))

# Sample WA-026 Seed Case
SEED_CASE_WA026 = {
    "case_number": "WA-026",
    "patient_name": "TASBEEHA",
    "case_date": "2025-12-30",
    "clinic_name": "WHILE ALIGNERS",
    "upper_aligners": 7,
    "lower_aligners": 10,
    "upper_days": 70,
    "lower_days": 100,
    "wear_days": 10,
    "elastic_type": "Class II / Anterior",
    "elastic_size": "3/16 inch Medium (4.5 oz)",
    "initial_image": "",
    "final_image": "",
    "movement_image_1": "",
    "movement_image_2": "",
    "pp_upper": "1-7",
    "pp_lower": "1-7",
    "notes": "Each aligner need to be worn for 10 days. Monitor space closure on anterior segment.",
    "status": "complete",
    "attachments": {
        "14": {"attachment": "Vertical Rectangular", "power_point": False, "button": "", "bite_ramp": False},
        "13": {"attachment": "Beveled", "power_point": True, "button": "Elastic Hook", "bite_ramp": False},
        "23": {"attachment": "Beveled", "power_point": True, "button": "", "bite_ramp": False},
        "24": {"attachment": "Vertical Rectangular", "power_point": False, "button": "", "bite_ramp": False},
        "44": {"attachment": "Horizontal Ellipsoid", "power_point": False, "button": "", "bite_ramp": False},
        "34": {"attachment": "Horizontal Ellipsoid", "power_point": False, "button": "", "bite_ramp": False},
        "46": {"attachment": "", "power_point": False, "button": "Button Cutout", "bite_ramp": False}
    },
    "upper_movements": {
        "18": {"inclination": 0, "inclination_change": 0, "angulation": 0, "angulation_change": 0, "rotation_change": 0, "mesial_change": 0, "vestibular_change": 0, "occlusal_change": 0, "strip_mesial": 0, "strip_distal": 0},
        "17": {"inclination": 29.8, "inclination_change": 0, "angulation": -10.7, "angulation_change": 0, "rotation_change": 0, "mesial_change": 0, "vestibular_change": 0, "occlusal_change": 0, "strip_mesial": 0, "strip_distal": 0},
        "16": {"inclination": -19.9, "inclination_change": 0, "angulation": -0.3, "angulation_change": 0, "rotation_change": 0, "mesial_change": 0, "vestibular_change": 0, "occlusal_change": 0, "strip_mesial": 0, "strip_distal": 0},
        "15": {"inclination": -5.9, "inclination_change": -2.0, "angulation": 12.6, "angulation_change": 0, "rotation_change": 0, "mesial_change": -0.06, "vestibular_change": 0, "occlusal_change": -0.01, "strip_mesial": 0, "strip_distal": 0},
        "14": {"inclination": -7.0, "inclination_change": -0.4, "angulation": 6.0, "angulation_change": 0.6, "rotation_change": 1.9, "mesial_change": -0.19, "vestibular_change": -0.03, "occlusal_change": 0, "strip_mesial": 0, "strip_distal": 0},
        "13": {"inclination": 4.8, "inclination_change": -2.3, "angulation": 9.5, "angulation_change": 6.5, "rotation_change": 0.1, "mesial_change": -0.34, "vestibular_change": 0.43, "occlusal_change": -0.35, "strip_mesial": 0, "strip_distal": 0},
        "12": {"inclination": 9.1, "inclination_change": -3.0, "angulation": 10.7, "angulation_change": 7.0, "rotation_change": 5.6, "mesial_change": -0.29, "vestibular_change": -0.02, "occlusal_change": -0.13, "strip_mesial": 0, "strip_distal": 0},
        "11": {"inclination": 13.2, "inclination_change": 3.5, "angulation": 7.9, "angulation_change": 1.5, "rotation_change": 3.7, "mesial_change": -0.15, "vestibular_change": -0.10, "occlusal_change": 0.14, "strip_mesial": 0, "strip_distal": 0},
        "21": {"inclination": 8.9, "inclination_change": 2.0, "angulation": 0.8, "angulation_change": 0.9, "rotation_change": -0.4, "mesial_change": 0.16, "vestibular_change": -0.30, "occlusal_change": 0.27, "strip_mesial": 0, "strip_distal": 0},
        "22": {"inclination": 12.1, "inclination_change": -2.8, "angulation": 7.2, "angulation_change": 2.7, "rotation_change": 5.4, "mesial_change": 0.08, "vestibular_change": 0, "occlusal_change": 0.45, "strip_mesial": 0, "strip_distal": 0},
        "23": {"inclination": 5.9, "inclination_change": -4.7, "angulation": 8.7, "angulation_change": 13.4, "rotation_change": 15.6, "mesial_change": 0.24, "vestibular_change": 0.09, "occlusal_change": -0.07, "strip_mesial": 0, "strip_distal": 0},
        "24": {"inclination": -4.1, "inclination_change": -1.3, "angulation": 5.8, "angulation_change": 1.3, "rotation_change": 5.8, "mesial_change": -0.04, "vestibular_change": -0.01, "occlusal_change": 0, "strip_mesial": 0, "strip_distal": 0},
        "25": {"inclination": -4.2, "inclination_change": -4.1, "angulation": 7.8, "angulation_change": 4.9, "rotation_change": 2.8, "mesial_change": -0.01, "vestibular_change": -0.01, "occlusal_change": 0.20, "strip_mesial": 0, "strip_distal": 0},
        "26": {"inclination": -13.4, "inclination_change": 0, "angulation": 0.9, "angulation_change": 0, "rotation_change": 0, "mesial_change": 0, "vestibular_change": 0, "occlusal_change": 0, "strip_mesial": 0, "strip_distal": 0},
        "27": {"inclination": 20.7, "inclination_change": 0, "angulation": 0.7, "angulation_change": 0, "rotation_change": 0, "mesial_change": 0, "vestibular_change": 0, "occlusal_change": 0, "strip_mesial": 0, "strip_distal": 0},
        "28": {"inclination": 0, "inclination_change": 0, "angulation": 0, "angulation_change": 0, "rotation_change": 0, "mesial_change": 0, "vestibular_change": 0, "occlusal_change": 0, "strip_mesial": 0, "strip_distal": 0}
    },
    "lower_movements": {
        "48": {"inclination": 0, "inclination_change": 0, "angulation": 0, "angulation_change": 0, "rotation_change": 0, "mesial_change": 0, "vestibular_change": 0, "occlusal_change": 0, "strip_mesial": 0, "strip_distal": 0},
        "47": {"inclination": -47.0, "inclination_change": 0, "angulation": 1.9, "angulation_change": 0, "rotation_change": 0, "mesial_change": 0, "vestibular_change": 0, "occlusal_change": 0, "strip_mesial": 0, "strip_distal": 0},
        "46": {"inclination": -45.2, "inclination_change": 0, "angulation": 16.5, "angulation_change": 0, "rotation_change": 0, "mesial_change": 0, "vestibular_change": 0, "occlusal_change": 0, "strip_mesial": 0, "strip_distal": 0},
        "45": {"inclination": -22.5, "inclination_change": 6.3, "angulation": 0.7, "angulation_change": -6.0, "rotation_change": 8.8, "mesial_change": -0.08, "vestibular_change": -0.61, "occlusal_change": 0.30, "strip_mesial": 0, "strip_distal": 0},
        "44": {"inclination": -22.6, "inclination_change": -2.0, "angulation": 3.2, "angulation_change": -2.9, "rotation_change": 23.7, "mesial_change": -0.43, "vestibular_change": -0.50, "occlusal_change": 0, "strip_mesial": 0, "strip_distal": 0},
        "43": {"inclination": -11.8, "inclination_change": 5.2, "angulation": 1.7, "angulation_change": -2.2, "rotation_change": 6.5, "mesial_change": -0.47, "vestibular_change": 0.58, "occlusal_change": -0.06, "strip_mesial": 0, "strip_distal": 0},
        "42": {"inclination": -6.5, "inclination_change": -5.9, "angulation": -1.5, "angulation_change": 2.5, "rotation_change": 1.5, "mesial_change": -0.46, "vestibular_change": -0.07, "occlusal_change": -0.09, "strip_mesial": 0, "strip_distal": 0},
        "41": {"inclination": -5.5, "inclination_change": -3.8, "angulation": -0.2, "angulation_change": 3.7, "rotation_change": 7.0, "mesial_change": -0.20, "vestibular_change": -0.31, "occlusal_change": -0.03, "strip_mesial": 0, "strip_distal": 0},
        "31": {"inclination": -2.0, "inclination_change": 0.3, "angulation": 0.9, "angulation_change": -1.3, "rotation_change": -5.9, "mesial_change": 0.11, "vestibular_change": -0.45, "occlusal_change": -0.08, "strip_mesial": 0, "strip_distal": 0},
        "32": {"inclination": -2.1, "inclination_change": -4.0, "angulation": -2.2, "angulation_change": 1.9, "rotation_change": -0.5, "mesial_change": 0.03, "vestibular_change": -0.52, "occlusal_change": -0.34, "strip_mesial": 0, "strip_distal": 0},
        "33": {"inclination": -8.8, "inclination_change": 5.5, "angulation": 1.4, "angulation_change": 2.3, "rotation_change": 7.8, "mesial_change": -0.01, "vestibular_change": 0.29, "occlusal_change": -0.22, "strip_mesial": 0, "strip_distal": 0},
        "34": {"inclination": -16.7, "inclination_change": 0.3, "angulation": -4.0, "angulation_change": -4.3, "rotation_change": 20.0, "mesial_change": -0.17, "vestibular_change": -0.46, "occlusal_change": 0.03, "strip_mesial": 0, "strip_distal": 0},
        "35": {"inclination": -21.3, "inclination_change": -1.1, "angulation": 1.2, "angulation_change": -5.6, "rotation_change": 17.4, "mesial_change": 0.08, "vestibular_change": -0.76, "occlusal_change": 0.11, "strip_mesial": 0, "strip_distal": 0},
        "36": {"inclination": -39.1, "inclination_change": 0, "angulation": 14.3, "angulation_change": 0, "rotation_change": 0, "mesial_change": 0, "vestibular_change": 0, "occlusal_change": 0, "strip_mesial": 0, "strip_distal": 0},
        "37": {"inclination": -44.6, "inclination_change": 0, "angulation": 1.3, "angulation_change": 0, "rotation_change": 0, "mesial_change": 0, "vestibular_change": 0, "occlusal_change": 0, "strip_mesial": 0, "strip_distal": 0},
        "38": {"inclination": 0, "inclination_change": 0, "angulation": 0, "angulation_change": 0, "rotation_change": 0, "mesial_change": 0, "vestibular_change": 0, "occlusal_change": 0, "strip_mesial": 0, "strip_distal": 0}
    },
    "upper_ipr": {
        "13-12": {"amount": 0.2, "stage": "Stage 2"},
        "12-11": {"amount": 0.3, "stage": "Stage 3"},
        "11-21": {"amount": 0.2, "stage": "Stage 1"},
        "21-22": {"amount": 0.3, "stage": "Stage 3"}
    },
    "lower_ipr": {
        "43-42": {"amount": 0.2, "stage": "Stage 2"},
        "42-41": {"amount": 0.3, "stage": "Stage 3"},
        "41-31": {"amount": 0.3, "stage": "Stage 3"},
        "31-32": {"amount": 0.3, "stage": "Stage 3"},
        "32-33": {"amount": 0.2, "stage": "Stage 2"}
    }
}

def init_db():
    conn = get_db()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                last_used TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS cases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_number TEXT UNIQUE NOT NULL,
                patient_name TEXT NOT NULL,
                case_date TEXT NOT NULL,
                clinic_name TEXT DEFAULT '',
                upper_aligners INTEGER DEFAULT 0,
                lower_aligners INTEGER DEFAULT 0,
                upper_days INTEGER DEFAULT 0,
                lower_days INTEGER DEFAULT 0,
                wear_days INTEGER DEFAULT 10,
                elastic_type TEXT DEFAULT '',
                elastic_size TEXT DEFAULT '',
                initial_image TEXT DEFAULT '',
                final_image TEXT DEFAULT '',
                pp_upper TEXT DEFAULT '',
                pp_lower TEXT DEFAULT '',
                notes TEXT DEFAULT '',
                status TEXT DEFAULT 'draft',
                attachments TEXT DEFAULT '{}',
                upper_movements TEXT DEFAULT '{}',
                lower_movements TEXT DEFAULT '{}',
                upper_ipr TEXT DEFAULT '{}',
                lower_ipr TEXT DEFAULT '{}',
                movement_image_1 TEXT DEFAULT '',
                movement_image_2 TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        # Migration safeguard
        for col in ['movement_image_1', 'movement_image_2']:
            try:
                conn.execute(f"ALTER TABLE cases ADD COLUMN {col} TEXT DEFAULT ''")
            except Exception:
                pass

        # Master PIN setup
        row = conn.execute("SELECT value FROM metadata WHERE key = 'pin_hash'").fetchone()
        if not row:
            hashed, salt = hash_pin(DEFAULT_PIN)
            conn.execute("INSERT OR REPLACE INTO metadata (key, value) VALUES ('pin_hash', ?)", (hashed,))
            conn.execute("INSERT OR REPLACE INTO metadata (key, value) VALUES ('pin_salt', ?)", (salt,))

        # Seed WA-026 if cases table is empty
        count = conn.execute("SELECT COUNT(*) as c FROM cases").fetchone()['c']
        if count == 0:
            now = datetime.utcnow().isoformat()
            c = SEED_CASE_WA026
            conn.execute("""
                INSERT INTO cases (
                    case_number, patient_name, case_date, clinic_name,
                    upper_aligners, lower_aligners, upper_days, lower_days, wear_days,
                    elastic_type, elastic_size, initial_image, final_image,
                    pp_upper, pp_lower, notes, status,
                    attachments, upper_movements, lower_movements, upper_ipr, lower_ipr,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                c["case_number"], c["patient_name"], c["case_date"], c["clinic_name"],
                c["upper_aligners"], c["lower_aligners"], c["upper_days"], c["lower_days"], c["wear_days"],
                c["elastic_type"], c["elastic_size"], c["initial_image"], c["final_image"],
                c["pp_upper"], c["pp_lower"], c["notes"], c["status"],
                json.dumps(c["attachments"]),
                json.dumps(c["upper_movements"]),
                json.dumps(c["lower_movements"]),
                json.dumps(c["upper_ipr"]),
                json.dumps(c["lower_ipr"]),
                now, now
            ))
            print("[DB] Initialized database with WA-026 seed case.")
    conn.close()

def is_valid_token(token: str) -> bool:
    if not token or len(token) < 20:
        return False
    conn = get_db()
    try:
        row = conn.execute("SELECT token FROM sessions WHERE token = ?", (token,)).fetchone()
        if row:
            now = datetime.utcnow().isoformat()
            conn.execute("UPDATE sessions SET last_used = ? WHERE token = ?", (now, token))
            conn.commit()
            return True
        return False
    finally:
        conn.close()

def create_session() -> str:
    token = secrets.token_hex(32)
    now = datetime.utcnow().isoformat()
    conn = get_db()
    with conn:
        conn.execute("INSERT INTO sessions (token, created_at, last_used) VALUES (?, ?, ?)", (token, now, now))
    conn.close()
    return token

def serialize_case_row(row):
    if not row:
        return None
    d = dict(row)
    for json_field in ['attachments', 'upper_movements', 'lower_movements', 'upper_ipr', 'lower_ipr']:
        if d.get(json_field):
            try:
                d[json_field] = json.loads(d[json_field])
            except Exception:
                d[json_field] = {}
        else:
            d[json_field] = {}
    return d

def get_all_cases():
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM cases ORDER BY id DESC").fetchall()
        return [serialize_case_row(r) for r in rows]
    finally:
        conn.close()

def get_case_by_id(case_id):
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM cases WHERE id = ? OR case_number = ?", (case_id, str(case_id))).fetchone()
        return serialize_case_row(row)
    finally:
        conn.close()

def get_next_case_number():
    conn = get_db()
    try:
        rows = conn.execute("SELECT case_number FROM cases").fetchall()
        max_num = 26
        for r in rows:
            num_match = re.search(r'(\d+)', r['case_number'])
            if num_match:
                n = int(num_match.group(1))
                if n > max_num:
                    max_num = n
        return f"WA-{max_num + 1:03d}"
    finally:
        conn.close()

def save_case(data, case_id=None):
    conn = get_db()
    now = datetime.utcnow().isoformat()
    
    # Calculate days if not explicitly set
    wear_days = int(data.get('wear_days') or 10)
    upper_aligners = int(data.get('upper_aligners') or 0)
    lower_aligners = int(data.get('lower_aligners') or 0)
    upper_days = int(data.get('upper_days') or (upper_aligners * wear_days))
    lower_days = int(data.get('lower_days') or (lower_aligners * wear_days))

    att_str = json.dumps(data.get('attachments') or {})
    umov_str = json.dumps(data.get('upper_movements') or {})
    lmov_str = json.dumps(data.get('lower_movements') or {})
    uipr_str = json.dumps(data.get('upper_ipr') or {})
    lipr_str = json.dumps(data.get('lower_ipr') or {})

    with conn:
        if case_id:
            conn.execute("""
                UPDATE cases SET
                    case_number = ?, patient_name = ?, case_date = ?, clinic_name = ?,
                    upper_aligners = ?, lower_aligners = ?, upper_days = ?, lower_days = ?, wear_days = ?,
                    elastic_type = ?, elastic_size = ?, initial_image = ?, final_image = ?,
                    movement_image_1 = ?, movement_image_2 = ?,
                    pp_upper = ?, pp_lower = ?, notes = ?, status = ?,
                    attachments = ?, upper_movements = ?, lower_movements = ?, upper_ipr = ?, lower_ipr = ?,
                    updated_at = ?
                WHERE id = ?
            """, (
                data.get('case_number', ''), data.get('patient_name', ''), data.get('case_date', ''), data.get('clinic_name', ''),
                upper_aligners, lower_aligners, upper_days, lower_days, wear_days,
                data.get('elastic_type', ''), data.get('elastic_size', ''), data.get('initial_image', ''), data.get('final_image', ''),
                data.get('movement_image_1', ''), data.get('movement_image_2', ''),
                data.get('pp_upper', ''), data.get('pp_lower', ''), data.get('notes', ''), data.get('status', 'draft'),
                att_str, umov_str, lmov_str, uipr_str, lipr_str,
                now, case_id
            ))
            saved_id = case_id
        else:
            case_num = data.get('case_number') or get_next_case_number()
            cursor = conn.execute("""
                INSERT INTO cases (
                    case_number, patient_name, case_date, clinic_name,
                    upper_aligners, lower_aligners, upper_days, lower_days, wear_days,
                    elastic_type, elastic_size, initial_image, final_image,
                    movement_image_1, movement_image_2,
                    pp_upper, pp_lower, notes, status,
                    attachments, upper_movements, lower_movements, upper_ipr, lower_ipr,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                case_num, data.get('patient_name', ''), data.get('case_date', ''), data.get('clinic_name', ''),
                upper_aligners, lower_aligners, upper_days, lower_days, wear_days,
                data.get('elastic_type', ''), data.get('elastic_size', ''), data.get('initial_image', ''), data.get('final_image', ''),
                data.get('movement_image_1', ''), data.get('movement_image_2', ''),
                data.get('pp_upper', ''), data.get('pp_lower', ''), data.get('notes', ''), data.get('status', 'draft'),
                att_str, umov_str, lmov_str, uipr_str, lipr_str,
                now, now
            ))
            saved_id = cursor.lastrowid
    conn.close()

    trigger_backup()
    return get_case_by_id(saved_id)

def delete_case(case_id):
    conn = get_db()
    with conn:
        conn.execute("DELETE FROM cases WHERE id = ?", (case_id,))
    conn.close()
    trigger_backup()

def trigger_backup():
    try:
        cases = get_all_cases()
        date_str = datetime.now().strftime("%Y-%m-%d")
        backup_file = os.path.join(BACKUP_DIR, f"cases-backup-{date_str}.json")
        with open(backup_file, 'w', encoding='utf-8') as f:
            json.dump(cases, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Backup Error]: {e}")

# ---------------------------------------------------------------------------
# Cloudflare Tunnel Manager
# ---------------------------------------------------------------------------
def start_cloudflare_tunnel(local_port):
    global TUNNEL_URL, TUNNEL_PROCESS
    if not os.path.exists(CLOUDFLARED_BIN):
        print("[Tunnel] cloudflared.exe not present in bin/. Running in local network mode.")
        return

    cmd = [
        CLOUDFLARED_BIN,
        "tunnel",
        "--url", f"http://127.0.0.1:{local_port}",
        "--no-autoupdate"
    ]

    print("[Tunnel] Initializing Cloudflare tunnel for team access...")
    try:
        TUNNEL_PROCESS = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='replace',
            bufsize=1
        )
    except Exception as e:
        print(f"[Tunnel Error] Could not start cloudflared: {e}")
        return

    def watch_tunnel():
        global TUNNEL_URL
        pattern = re.compile(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
        for line in TUNNEL_PROCESS.stderr:
            match = pattern.search(line)
            if match and not TUNNEL_URL:
                TUNNEL_URL = match.group(0)
                try:
                    with open(URL_FILE, 'w', encoding='utf-8') as f:
                        f.write(TUNNEL_URL)
                except Exception:
                    pass
                print("\n" + "=" * 64)
                print("  ✦ VÉLOURCARE TEAM ACCESS (PHONE & WEB) ✦")
                print("=" * 64)
                print(f"  Live HTTPS URL: {TUNNEL_URL}")
                print("=" * 64 + "\n")

    threading.Thread(target=watch_tunnel, daemon=True).start()

# ---------------------------------------------------------------------------
# HTTP & REST API Request Handler
# ---------------------------------------------------------------------------
class CaseReportHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def send_json(self, status_code, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.end_headers()

    def get_token(self):
        return self.headers.get('X-Session-Token', '').strip()

    def serve_external_file(self, file_path, content_type=None):
        if not os.path.isfile(file_path):
            self.send_json(404, {"error": "File not found"})
            return

        stat = os.stat(file_path)
        if not content_type:
            ext = os.path.splitext(file_path)[1].lower()
            types = {
                '.html': 'text/html; charset=utf-8',
                '.js': 'application/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8',
                '.stl': 'model/stl',
                '.json': 'application/json; charset=utf-8',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.svg': 'image/svg+xml',
            }
            content_type = types.get(ext, 'application/octet-stream')

        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(stat.st_size))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.end_headers()

        with open(file_path, 'rb') as f:
            shutil.copyfileobj(f, self.wfile)

    def read_json_body(self):
        content_len = int(self.headers.get('Content-Length', 0))
        if content_len == 0:
            return {}
        raw = self.rfile.read(content_len).decode('utf-8')
        return json.loads(raw)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 3D WebViewer UI routes
        if path == '/viewer' or path == '/viewer/':
            self.send_response(302)
            loc = '/viewer/index.html' + (f'?{parsed.query}' if parsed.query else '')
            self.send_header('Location', loc)
            self.end_headers()
            return

        if path.startswith('/viewer/'):
            subpath = path[len('/viewer/'):]
            target_file = os.path.join(VIEWER_DIR, subpath.replace('/', os.sep))
            if os.path.isfile(target_file):
                self.serve_external_file(target_file)
                return
            else:
                self.send_json(404, {"error": "Viewer file not found"})
                return

        # Native OnyxCeph WebViewer routes (e.g. /onyx/Viewer/show.html)
        if path.startswith('/onyx/Viewer/'):
            subpath = path[len('/onyx/Viewer/'):]
            target_file = os.path.join(NATIVE_ONYX_VIEWER_DIR, subpath.replace('/', os.sep))
            if os.path.isfile(target_file):
                self.serve_external_file(target_file)
                return
            else:
                self.send_json(404, {"error": "Native viewer file not found"})
                return

        # Native OnyxCeph uploaded data routes (e.g. /onyx/Client5359/.../*.iiwgl or /onyx/Client0/.../*.iiwgl)
        if path.startswith('/onyx/'):
            subpath = path[len('/onyx/'):]
            target_file = os.path.join(VIEWER_CASES_DIR, subpath.replace('/', os.sep))
            if os.path.isfile(target_file):
                if target_file.lower().endswith('.iiwgl'):
                    ensure_iiwgl_ready(target_file)
                self.serve_external_file(target_file, content_type='application/octet-stream')
                return
            sample_file = os.path.join(NATIVE_ONYX_VIEWER_DIR, subpath.replace('/', os.sep))
            if os.path.isfile(sample_file):
                if sample_file.lower().endswith('.iiwgl'):
                    ensure_iiwgl_ready(sample_file)
                self.serve_external_file(sample_file, content_type='application/octet-stream')
                return
            # Fallback recursive search by filename across VIEWER_CASES_DIR
            fname = os.path.basename(subpath)
            for r_dir, _, files in os.walk(VIEWER_CASES_DIR):
                if fname in files:
                    found_f = os.path.join(r_dir, fname)
                    if found_f.lower().endswith('.iiwgl'):
                        ensure_iiwgl_ready(found_f)
                    self.serve_external_file(found_f, content_type='application/octet-stream')
                    return


        # 3D Case Manifest
        manifest_match = re.match(r'^/api/cases/([^/]+)/manifest$', path)
        if manifest_match:
            cid = manifest_match.group(1)
            m_path = os.path.join(VIEWER_CASES_DIR, cid, "manifest.json")
            if os.path.isfile(m_path):
                self.serve_external_file(m_path, content_type='application/json; charset=utf-8')
            else:
                self.send_json(404, {"error": f"3D manifest not found for {cid}"})
            return

        # 3D Case Mesh (STL)
        mesh_match = re.match(r'^/api/cases/([^/]+)/mesh/([^/]+)$', path)
        if mesh_match:
            cid, mname = mesh_match.group(1), mesh_match.group(2)
            mesh_path = os.path.join(VIEWER_CASES_DIR, cid, mname)
            if os.path.isfile(mesh_path):
                self.serve_external_file(mesh_path, content_type='model/stl')
            else:
                self.send_json(404, {"error": f"Mesh {mname} not found"})
            return

        # Tunnel status
        if path == '/api/tunnel-url':
            self.send_json(200, {"url": TUNNEL_URL, "status": "online" if TUNNEL_URL else "connecting"})
            return

        # Next case number
        if path == '/api/next-case-number':
            self.send_json(200, {"next_case_number": get_next_case_number()})
            return

        # Case list
        if path == '/api/cases':
            cases = get_all_cases()
            self.send_json(200, {"ok": True, "cases": cases})
            return

        # Single case
        case_match = re.match(r'^/api/cases/([^/]+)$', path)
        if case_match:
            case_id = case_match.group(1)
            case_data = get_case_by_id(case_id)
            if case_data:
                self.send_json(200, {"ok": True, "case": case_data})
            else:
                self.send_json(404, {"error": "Case not found"})
            return

        # Static files fallback
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Login
        if path == '/api/auth/login':
            body = self.read_json_body()
            pin = body.get('pin', '')
            conn = get_db()
            try:
                row_h = conn.execute("SELECT value FROM metadata WHERE key = 'pin_hash'").fetchone()
                row_s = conn.execute("SELECT value FROM metadata WHERE key = 'pin_salt'").fetchone()
                if row_h and row_s and verify_pin(pin, row_h['value'], row_s['value']):
                    token = create_session()
                    self.send_json(200, {"ok": True, "token": token})
                else:
                    self.send_json(401, {"error": "Invalid PIN"})
            finally:
                conn.close()
            return

        # Change PIN
        if path == '/api/auth/change-pin':
            body = self.read_json_body()
            current_pin = body.get('current_pin', '')
            new_pin = body.get('new_pin', '')
            if len(new_pin) < 4:
                self.send_json(400, {"error": "PIN must be at least 4 digits"})
                return
            conn = get_db()
            try:
                row_h = conn.execute("SELECT value FROM metadata WHERE key = 'pin_hash'").fetchone()
                row_s = conn.execute("SELECT value FROM metadata WHERE key = 'pin_salt'").fetchone()
                if row_h and row_s and verify_pin(current_pin, row_h['value'], row_s['value']):
                    hashed, salt = hash_pin(new_pin)
                    with conn:
                        conn.execute("UPDATE metadata SET value = ? WHERE key = 'pin_hash'", (hashed,))
                        conn.execute("UPDATE metadata SET value = ? WHERE key = 'pin_salt'", (salt,))
                    self.send_json(200, {"ok": True, "message": "PIN updated"})
                else:
                    self.send_json(401, {"error": "Current PIN incorrect"})
            finally:
                conn.close()
            return

        # Create new case
        if path == '/api/cases':
            try:
                data = self.read_json_body()
                saved = save_case(data)
                self.send_json(201, {"ok": True, "case": saved})
            except Exception as e:
                self.send_json(400, {"error": f"Failed to save case: {e}"})
            return

        # Image Upload (Base64 data URL)
        if path == '/api/upload':
            try:
                body = self.read_json_body()
                data_url = body.get('dataUrl', '')
                prefix = body.get('prefix', 'photo')
                if not data_url or ';base64,' not in data_url:
                    self.send_json(400, {"error": "Invalid base64 image data URL"})
                    return

                header, base64_str = data_url.split(';base64,', 1)
                ext = 'png'
                if 'jpeg' in header or 'jpg' in header:
                    ext = 'jpg'
                elif 'webp' in header:
                    ext = 'webp'

                import base64
                file_bytes = base64.b64decode(base64_str)
                filename = f"{prefix}_{int(time.time())}_{secrets.token_hex(4)}.{ext}"
                target_path = os.path.join(UPLOADS_DIR, filename)
                with open(target_path, 'wb') as f:
                    f.write(file_bytes)

                self.send_json(200, {
                    "ok": True,
                    "filename": filename,
                    "url": f"/uploads/{filename}"
                })
            except Exception as e:
                self.send_json(500, {"error": f"Upload failed: {e}"})
            return

        # 3D Case Approval
        approve_match = re.match(r'^/api/cases/([^/]+)/approve$', path)
        if approve_match:
            cid = approve_match.group(1)
            body = self.read_json_body()
            doc = body.get('doctor', 'Doctor')
            print(f"[3D Setup] Case {cid} approved by Dr. {doc}")
            self.send_json(200, {"ok": True, "message": f"Case {cid} approved by Dr. {doc}"})
            return

        # 3D Case Revision Request
        revise_match = re.match(r'^/api/cases/([^/]+)/revise$', path)
        if revise_match:
            cid = revise_match.group(1)
            body = self.read_json_body()
            notes = body.get('notes', '')
            print(f"[3D Setup] Case {cid} modification requested: {notes}")
            self.send_json(200, {"ok": True, "message": f"Revision request logged for {cid}"})
            return

        self.send_json(404, {"error": "Endpoint not found"})

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        case_match = re.match(r'^/api/cases/(\d+)$', path)
        if case_match:
            case_id = int(case_match.group(1))
            try:
                data = self.read_json_body()
                saved = save_case(data, case_id=case_id)
                self.send_json(200, {"ok": True, "case": saved})
            except Exception as e:
                self.send_json(400, {"error": f"Failed to update case: {e}"})
            return

        self.send_json(404, {"error": "Endpoint not found"})

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        case_match = re.match(r'^/api/cases/(\d+)$', path)
        if case_match:
            case_id = int(case_match.group(1))
            try:
                delete_case(case_id)
                self.send_json(200, {"ok": True, "deleted_id": case_id})
            except Exception as e:
                self.send_json(400, {"error": f"Failed to delete case: {e}"})
            return

        self.send_json(404, {"error": "Endpoint not found"})

    def log_message(self, format, *args):
        if '/api/tunnel-url' in self.path:
            return
        if self.path in ('/', '/index.html') or '/api/' in self.path:
            sys.stdout.write(f"[Server] {self.address_string()} - {format%args}\n")

# ---------------------------------------------------------------------------
# Server Startup
# ---------------------------------------------------------------------------
def find_available_port(start_port=PREFERRED_PORT, max_attempts=20):
    import socket
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    return start_port

def open_browser(url):
    time.sleep(1.2)
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"Browser launch note: {e}")

def main():
    os.chdir(BASE_DIR)
    init_db()

    port = find_available_port(PREFERRED_PORT)
    local_url = f"http://localhost:{port}/"

    print("=" * 64)
    print("  ✦ VÉLOURCARE ORTHO — CASE REPORT MANAGER ✦")
    print("=" * 64)
    print(f"  Local Web App : {local_url}")
    print(f"  Database      : {DB_PATH}")
    print(f"  Uploads Dir   : {UPLOADS_DIR}")
    print(f"  Default PIN   : {DEFAULT_PIN}")
    print("=" * 64)

    start_cloudflare_tunnel(port)
    threading.Thread(target=open_browser, args=(local_url,), daemon=True).start()

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('0.0.0.0', port), CaseReportHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down VélourCare case manager...")
            if TUNNEL_PROCESS:
                try:
                    TUNNEL_PROCESS.terminate()
                except Exception:
                    pass
            httpd.shutdown()

if __name__ == '__main__':
    main()
