#!/usr/bin/env python3
"""
Comprehensive Verification Suite for Medo — MBBS Student Blog & Notes Hub
Verifies database operations, security, authentication with anuja2007 / anuskar2020@,
study notes APIs, medical blog posts, in-process HTTP request handler, and credential privacy checks.
"""

import sys
import os
import json
import sqlite3
import hmac
import time
from io import BytesIO, StringIO

from database import init_db, get_db, hash_password, DB_PATH
from server import (
    MedoServerHandler,
    calculate_reading_time,
    generate_slug,
    check_login_rate_limit,
    record_failed_login,
    reset_failed_login,
    FAILED_LOGIN_ATTEMPTS
)

class MockSocket:
    """Mock socket for in-process HTTP request/response execution."""
    def __init__(self, raw_data: bytes):
        self.rfile = BytesIO(raw_data)
        self.wfile = BytesIO()

    def makefile(self, mode, *args, **kwargs):
        if 'r' in mode:
            return self.rfile
        return self.wfile

    def sendall(self, b):
        self.wfile.write(b)

def execute_http_request(method: str, path: str, headers: dict = None, body: bytes = b'', client_ip: str = '127.0.0.1') -> tuple[int, dict, str]:
    """Execute in-process HTTP request through MedoServerHandler without opening network sockets."""
    headers = headers or {}
    header_lines = [f"{method} {path} HTTP/1.1", f"Host: localhost"]
    for k, v in headers.items():
        header_lines.append(f"{k}: {v}")
    if body and 'Content-Length' not in headers:
        header_lines.append(f"Content-Length: {len(body)}")

    raw_req = "\r\n".join(header_lines).encode('utf-8') + b"\r\n\r\n" + body
    sock = MockSocket(raw_req)

    # Disable stderr logging during test runs
    old_stderr = sys.stderr
    sys.stderr = StringIO()
    try:
        MedoServerHandler(sock, (client_ip, 50000), None)
    finally:
        sys.stderr = old_stderr

    raw_resp = sock.wfile.getvalue().decode('utf-8', errors='replace')
    status_line = raw_resp.splitlines()[0]
    status_code = int(status_line.split()[1])

    # Extract headers and body
    parts = raw_resp.split("\r\n\r\n", 1)
    resp_headers = {}
    for line in parts[0].splitlines()[1:]:
        if ":" in line:
            k, v = line.split(":", 1)
            resp_headers[k.strip().lower()] = v.strip()

    resp_body = parts[1] if len(parts) > 1 else ""
    return status_code, resp_headers, resp_body

def run_medo_tests():
    print("=" * 65)
    print("🩺 Running Comprehensive Medo Verification Suite...")
    print("=" * 65 + "\n")

    # 1. Initialize & Verify Database Schema & Seed Data
    print("1. Verifying Database Schema & Medical Seed Content...")
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    # Admin user check
    cursor.execute("SELECT * FROM users WHERE username = 'anuja2007'")
    admin = cursor.fetchone()
    assert admin is not None, "Admin user 'anuja2007' missing from users table!"
    assert admin['name'] == 'Dr. Anuja', f"Expected name 'Dr. Anuja', got {admin['name']}"
    assert admin['email'] == 'anuja2007@medo.com', f"Expected email 'anuja2007@medo.com', got {admin['email']}"
    assert admin['role'] == 'admin', "Expected admin role"
    print("   ✓ Admin user verified (Username: anuja2007, Role: admin, Name: Dr. Anuja)")

    # Password hash check
    expected_hash = hash_password("anuskar2020@")
    assert hmac.compare_digest(admin['password_hash'], expected_hash), "Password hash for anuskar2020@ did not match!"
    print("   ✓ Admin password hash verified (PBKDF2-HMAC-SHA256)")

    # Negative password check
    wrong_hash = hash_password("wrong_password")
    assert not hmac.compare_digest(admin['password_hash'], wrong_hash), "Wrong password unexpectedly passed!"
    print("   ✓ Incorrect password verification properly rejected")

    # Notes table check
    cursor.execute("SELECT COUNT(*) as c FROM notes WHERE status = 'published'")
    pub_notes = cursor.fetchone()['c']
    assert pub_notes >= 7, f"Expected >=7 published notes, got {pub_notes}"
    print(f"   ✓ Study Notes verified ({pub_notes} high-yield notes ready)")

    # Check note subjects and prof years
    cursor.execute("SELECT DISTINCT subject FROM notes")
    subjects = [r['subject'] for r in cursor.fetchall()]
    assert "Anatomy" in subjects and "Pharmacology" in subjects and "Pathology" in subjects, f"Missing key subjects in {subjects}"
    print(f"   ✓ Verified medical subjects: {', '.join(subjects[:5])}...")

    # Posts table check
    cursor.execute("SELECT COUNT(*) as c FROM posts WHERE status = 'published'")
    pub_posts = cursor.fetchone()['c']
    assert pub_posts >= 5, f"Expected >=5 published posts, got {pub_posts}"
    print(f"   ✓ Medical blog articles verified ({pub_posts} articles ready)")

    # Categories check
    cursor.execute("SELECT COUNT(*) as c FROM categories")
    cat_count = cursor.fetchone()['c']
    assert cat_count >= 6, f"Expected >=6 categories, got {cat_count}"
    print(f"   ✓ Medical categories verified ({cat_count} categories ready)")

    # Comments check
    cursor.execute("SELECT COUNT(*) as c FROM comments")
    comm_count = cursor.fetchone()['c']
    assert comm_count >= 4, "Medical comments missing"
    print(f"   ✓ Reader comments verified ({comm_count} comments)")

    conn.close()

    # 2. Reading time & slug calculation utilities
    print("\n2. Testing Utility Helpers (Slug Generator & Medical Reading Time)...")
    text_sample = "medical " * 600
    rt = calculate_reading_time(text_sample)
    assert rt == 3, f"Expected 3 min read for 600 words, got {rt}"
    print(f"   ✓ Reading time calculation verified ({rt} mins for 600 words)")

    slug = generate_slug("High-Yield Brachial Plexus: Roots, Cords & Clinical Lesions (Erb's & Klumpke's)")
    assert slug == "high-yield-brachial-plexus-roots-cords-clinical-lesions-erbs-klumpkes", f"Unexpected slug: {slug}"
    print(f"   ✓ Slug generation verified: '{slug}'")

    # 3. Security & Rate Limiting Verification
    print("\n3. Testing Security Protection & Brute Force Rate Limiting...")
    test_ip = "192.168.1.99"
    reset_failed_login(test_ip)

    # Initial check
    allowed, rem = check_login_rate_limit(test_ip)
    assert allowed is True and rem == 0
    print("   ✓ Clean IP permitted for login")

    # Record 5 failed attempts
    for _ in range(5):
        record_failed_login(test_ip)

    allowed, rem = check_login_rate_limit(test_ip)
    assert allowed is False, "Rate limiter failed to block IP after 5 attempts!"
    assert rem > 0, "Rate limiter did not set positive cooldown!"
    print(f"   ✓ Brute-force rate limiter activated (IP blocked with {rem}s cooldown)")

    # Reset
    reset_failed_login(test_ip)
    allowed, _ = check_login_rate_limit(test_ip)
    assert allowed is True, "Reset failed"
    print("   ✓ Reset rate limit cleared successfully")

    # 4. Credential Privacy Scan
    print("\n4. Verifying Credentials Privacy (No Password Leakage in Frontend)...")
    sensitive_secret = "anuskar2020@"
    frontend_files = [
        "templates/index.html",
        "static/js/app.js",
        "static/js/admin.js",
        "static/js/api.js",
        "static/css/styles.css"
    ]

    for fpath in frontend_files:
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
            assert sensitive_secret not in content, f"SECURITY ALERT: Plaintext password found in {fpath}!"
            assert "admin12345" not in content, f"Legacy demo password found in {fpath}!"
        print(f"   ✓ Clean: No sensitive credentials in {fpath}")

    # 5. In-Process HTTP Server Handler End-to-End Tests
    print("\n5. Testing In-Process REST API Endpoints & Auth Flow...")

    # A. Test Public GET /
    status, headers, body = execute_http_request("GET", "/")
    assert status == 200, f"Expected 200, got {status}"
    assert "medo" in body.lower(), "Expected 'medo' in HTML"
    assert "x-content-type-options" in headers, "Missing security headers!"
    print("   ✓ GET / returned 200 with security headers and Medo SPA HTML")

    # B. Test Public GET /api/notes
    status, _, body = execute_http_request("GET", "/api/notes")
    assert status == 200, f"Expected 200, got {status}"
    notes_json = json.loads(body)
    assert notes_json["success"] is True
    assert len(notes_json["notes"]) >= 7
    print(f"   ✓ GET /api/notes returned {len(notes_json['notes'])} study notes")

    # C. Test Note filtering by subject (Anatomy)
    status, _, body = execute_http_request("GET", "/api/notes?subject=Anatomy")
    assert status == 200
    filtered_json = json.loads(body)
    assert all(n['subject'] == 'Anatomy' for n in filtered_json['notes'])
    print(f"   ✓ GET /api/notes?subject=Anatomy filtered {len(filtered_json['notes'])} notes")

    # D. Test Auth Login with username 'anuja2007' and password 'anuskar2020@'
    login_body = json.dumps({"username": "anuja2007", "password": "anuskar2020@"}).encode('utf-8')
    status, headers, body = execute_http_request("POST", "/api/auth/login", {"Content-Type": "application/json"}, login_body)
    assert status == 200, f"Login failed with status {status}: {body}"
    login_resp = json.loads(body)
    assert login_resp["success"] is True
    session_token = login_resp["token"]
    assert "set-cookie" in headers, "Missing session cookie in login response"
    assert "medo_session=" in headers["set-cookie"], "Expected medo_session in cookie"
    print(f"   ✓ POST /api/auth/login successful for 'anuja2007' (token issued, HttpOnly cookie set)")

    # E. Test Auth Login with email 'anuja2007@medo.com'
    login_body_email = json.dumps({"email": "anuja2007@medo.com", "password": "anuskar2020@"}).encode('utf-8')
    status, _, body = execute_http_request("POST", "/api/auth/login", {"Content-Type": "application/json"}, login_body_email)
    assert status == 200
    print("   ✓ POST /api/auth/login successful using email 'anuja2007@medo.com'")

    # F. Test Login with bad credentials (rejected)
    bad_login_body = json.dumps({"username": "anuja2007", "password": "wrong_password!"}).encode('utf-8')
    status, _, _ = execute_http_request("POST", "/api/auth/login", {"Content-Type": "application/json"}, bad_login_body)
    assert status == 401
    print("   ✓ POST /api/auth/login properly rejected invalid password (401)")

    # G. Test Admin GET /api/admin/stats with Bearer Token
    auth_header = {"Authorization": f"Bearer {session_token}"}
    status, _, body = execute_http_request("GET", "/api/admin/stats", auth_header)
    assert status == 200
    stats_json = json.loads(body)
    assert stats_json["stats"]["total_notes"] >= 7
    assert stats_json["stats"]["total_posts"] >= 5
    print(f"   ✓ GET /api/admin/stats authorized ({stats_json['stats']['total_notes']} notes, {stats_json['stats']['total_posts']} posts)")

    # H. Test Admin POST /api/admin/notes (Create Note)
    new_note_data = {
        "title": "Autonomic Nervous System Receptors & Agonists Guide",
        "slug": f"ans-receptors-guide-{int(time.time())}",
        "subject": "Pharmacology",
        "prof_year": "2nd Prof",
        "topic": "Autonomic Pharmacology",
        "summary": "Alpha-1, Alpha-2, Beta-1, Beta-2 G-protein maps and high-yield receptor distribution.",
        "content": "## ANS Receptors\n\n- Alpha-1: Gq (vascular smooth muscle)\n- Beta-1: Gs (heart)",
        "download_url": "https://example.com/ans.pdf",
        "is_high_yield": 1,
        "status": "published"
    }
    status, _, body = execute_http_request(
        "POST",
        "/api/admin/notes",
        {"Content-Type": "application/json", "Authorization": f"Bearer {session_token}"},
        json.dumps(new_note_data).encode('utf-8')
    )
    assert status == 200, f"Failed creating note: {body}"
    created_note = json.loads(body)
    note_id = created_note["note_id"]
    print(f"   ✓ POST /api/admin/notes created note #{note_id} ('{new_note_data['title']}')")

    # I. Test Public GET /api/notes/<slug>
    status, _, body = execute_http_request("GET", f"/api/notes/{new_note_data['slug']}")
    assert status == 200
    single_note_json = json.loads(body)
    assert single_note_json["note"]["title"] == new_note_data["title"]
    assert single_note_json["note"]["views"] >= 1
    print(f"   ✓ GET /api/notes/{new_note_data['slug']} returned note with auto-incremented view count")

    # J. Test POST /api/notes/<id>/download
    status, _, body = execute_http_request("POST", f"/api/notes/{note_id}/download")
    assert status == 200
    dl_json = json.loads(body)
    assert dl_json["downloads_count"] == 1
    print("   ✓ POST /api/notes/<id>/download incremented downloads counter")

    # K. Test Admin PUT /api/admin/notes/<id> (Update Note)
    update_data = {
        "title": "Autonomic Nervous System Receptors & Agonists Guide (Updated)",
        "content": "## Updated ANS Content",
        "is_high_yield": 1,
        "status": "published"
    }
    status, _, body = execute_http_request(
        "PUT",
        f"/api/admin/notes/{note_id}",
        {"Content-Type": "application/json", "Authorization": f"Bearer {session_token}"},
        json.dumps(update_data).encode('utf-8')
    )
    assert status == 200
    print(f"   ✓ PUT /api/admin/notes/{note_id} updated successfully")

    # L. Test Admin DELETE /api/admin/notes/<id>
    status, _, body = execute_http_request(
        "DELETE",
        f"/api/admin/notes/{note_id}",
        {"Authorization": f"Bearer {session_token}"}
    )
    assert status == 200
    print(f"   ✓ DELETE /api/admin/notes/{note_id} deleted successfully")

    # M. Test Public POST /api/posts/<id>/like
    status, _, body = execute_http_request("POST", "/api/posts/1/like", client_ip="10.0.0.1")
    assert status == 200
    print("   ✓ POST /api/posts/1/like recorded reader like")

    # 6. Static Asset Verification
    print("\n6. Checking Static Asset Sizes & Paths...")
    for fpath in frontend_files:
        assert os.path.exists(fpath), f"File missing: {fpath}"
        sz = os.path.getsize(fpath)
        print(f"   ✓ {fpath} ({sz:,} bytes)")

    print("\n" + "=" * 65)
    print("🎉 ALL MEDO MBBS PLATFORM IN-PROCESS & API TESTS PASSED PERFECTLY!")
    print("=" * 65)

if __name__ == "__main__":
    run_medo_tests()
