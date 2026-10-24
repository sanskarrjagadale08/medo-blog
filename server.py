#!/usr/bin/env python3
"""
Medo — The High-Performance MBBS Student Web & API Server
Serves REST API, Admin CMS, Study Notes, Medical Blogs, and Modern Responsive Frontend.
"""

import os
import sys
import json
import sqlite3
import urllib.parse
import hashlib
import hmac
import secrets
import mimetypes
import time
from datetime import datetime, timezone, timedelta
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import base64

from database import get_db, hash_password, init_db, DB_PATH, UPLOADS_DIR

PORT = int(os.environ.get("PORT", 8080))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

# Ensure required directories exist
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(TEMPLATES_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Rate limiting for brute-force protection
FAILED_LOGIN_ATTEMPTS = {}  # ip -> {'count': int, 'locked_until': float}

def check_login_rate_limit(client_ip: str) -> tuple[bool, int]:
    """Check if client IP is currently rate-limited. Returns (is_allowed, remaining_seconds)."""
    now = time.time()
    record = FAILED_LOGIN_ATTEMPTS.get(client_ip)
    if record and record.get('locked_until', 0) > now:
        remaining = int(record['locked_until'] - now)
        return False, remaining
    return True, 0

def record_failed_login(client_ip: str):
    """Record a failed login attempt and lock if threshold exceeded."""
    now = time.time()
    record = FAILED_LOGIN_ATTEMPTS.get(client_ip, {'count': 0, 'locked_until': 0})
    record['count'] += 1
    if record['count'] >= 5:
        # Lock for 5 minutes (300 seconds)
        record['locked_until'] = now + 300
    FAILED_LOGIN_ATTEMPTS[client_ip] = record

def reset_failed_login(client_ip: str):
    """Clear failed login attempts on successful authentication."""
    if client_ip in FAILED_LOGIN_ATTEMPTS:
        del FAILED_LOGIN_ATTEMPTS[client_ip]

def dict_from_row(row):
    """Convert sqlite3.Row to dict."""
    if row is None:
        return None
    return dict(row)

def dict_list_from_rows(rows):
    """Convert list of sqlite3.Row to list of dicts."""
    return [dict(r) for r in rows]

def calculate_reading_time(text: str) -> int:
    """Calculate reading time in minutes (avg 200 wpm)."""
    if not text:
        return 1
    words = len(text.split())
    minutes = max(1, round(words / 200))
    return minutes

def generate_slug(text: str) -> str:
    """Convert title or string to URL-friendly slug safely."""
    import re
    if not text:
        return f"item-{int(time.time())}"
    text = str(text).lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s-]+', '-', text).strip('-')
    return text or f"item-{int(time.time())}"

def publish_scheduled_posts(cursor, conn):
    """Automatically promote scheduled posts whose release time has passed to published."""
    now_str = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute("""
    UPDATE posts
    SET status = 'published',
        published_at = COALESCE(scheduled_at, ?),
        updated_at = ?
    WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
    """, (now_str, now_str, now_str))
    conn.commit()

class MedoServerHandler(BaseHTTPRequestHandler):
    """Custom HTTP request handler with REST API, Admin CMS, and Medical Student SPA routing."""

    def log_message(self, format, *args):
        """Custom clean logging."""
        try:
            if len(args) >= 3:
                sys.stderr.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {args[0]} {args[1]} -> {args[2]}\n")
            else:
                sys.stderr.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {format % args}\n")
        except Exception:
            pass

    def send_security_headers(self):
        """Send modern web security headers on all responses."""
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('X-XSS-Protection', '1; mode=block')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        self.send_header('Content-Security-Policy', "default-src 'self' 'unsafe-inline' https: data: blob:; img-src 'self' https: data: blob:; font-src 'self' https: fonts.gstatic.com;")

    def send_json(self, data, status=200, cookie_token=None):
        """Send JSON response with security headers and optional session cookie."""
        response_bytes = json.dumps(data, default=str).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response_bytes)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        if cookie_token:
            self.send_header('Set-Cookie', f"medo_session={cookie_token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax")
        self.send_security_headers()
        self.end_headers()
        self.wfile.write(response_bytes)

    def send_error_json(self, message, status=400):
        """Send formatted JSON error."""
        self.send_json({"error": message, "success": False}, status=status)

    def do_OPTIONS(self):
        """Handle CORS pre-flight requests."""
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_security_headers()
        self.end_headers()

    def get_client_ip(self) -> str:
        """Extract client IP address for rate limiting."""
        forwarded = self.headers.get('X-Forwarded-For')
        if forwarded:
            return forwarded.split(',')[0].strip()
        return self.client_address[0] if self.client_address else '127.0.0.1'

    def get_auth_user(self):
        """Verify Authorization Bearer token or session cookie."""
        token = None
        auth_header = self.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1].strip()
        
        if not token:
            cookie_header = self.headers.get('Cookie')
            if cookie_header:
                for cookie in cookie_header.split(';'):
                    cookie_str = cookie.strip()
                    if cookie_str.startswith('medo_session='):
                        token = cookie_str.split('medo_session=', 1)[1].strip()
                        break
                    elif cookie_str.startswith('mdei_session='):
                        token = cookie_str.split('mdei_session=', 1)[1].strip()
                        break

        if not token:
            return None

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
        SELECT u.id, u.name, u.username, u.email, u.role, u.avatar, u.bio, u.twitter, u.github, u.linkedin
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
        ''', (token,))
        user = cursor.fetchone()
        conn.close()
        return dict_from_row(user)

    def parse_body_json(self):
        """Parse JSON request body safely."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length <= 0:
                return {}
            body_bytes = self.rfile.read(content_length)
            return json.loads(body_bytes.decode('utf-8'))
        except Exception:
            return None

    def serve_file(self, file_path, content_type=None):
        """Safely serve a static file from disk."""
        if not os.path.exists(file_path) or os.path.isdir(file_path):
            self.send_response(404)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_security_headers()
            self.end_headers()
            self.wfile.write(b"404 Not Found")
            return

        if not content_type:
            content_type, _ = mimetypes.guess_type(file_path)
            if not content_type:
                content_type = 'application/octet-stream'

        try:
            with open(file_path, 'rb') as f:
                content = f.read()

            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'public, max-age=3600')
            self.send_security_headers()
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(f"500 Internal Server Error: {e}".encode('utf-8'))

    def do_GET(self):
        """Handle GET requests for static files, views, and API routes."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = urllib.parse.parse_qs(parsed_url.query)

        # 1. API Routes
        if path.startswith('/api/') or path == '/api':
            self.handle_api_get(path, query)
            return

        # 2. Static Assets (/static/...)
        if path.startswith('/static/'):
            rel_path = path[len('/static/'):].lstrip('/')
            file_path = os.path.join(STATIC_DIR, rel_path)
            self.serve_file(file_path)
            return

        # 3. Uploaded Media (/uploads/...)
        if path.startswith('/uploads/'):
            rel_path = path[len('/uploads/'):].lstrip('/')
            file_path = os.path.join(UPLOADS_DIR, rel_path)
            self.serve_file(file_path)
            return

        # 4. Favicon or robots.txt
        if path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
            return

        # 5. SPA Shell (Serve index.html for all public & admin HTML routes)
        index_file = os.path.join(TEMPLATES_DIR, "index.html")
        self.serve_file(index_file, content_type="text/html; charset=utf-8")

    def handle_api_get(self, raw_path, query):
        """Handle GET API endpoints."""
        path = raw_path.rstrip('/')
        conn = get_db()
        cursor = conn.cursor()
        publish_scheduled_posts(cursor, conn)

        try:
            # GET /api/auth/me
            if path == '/api/auth/me':
                user = self.get_auth_user()
                if not user:
                    self.send_error_json("Unauthorized", 401)
                    return
                self.send_json({"user": user, "success": True})
                return

            # GET /api/posts - Public posts list (Medical Blogs)
            if path == '/api/posts':
                page = max(1, int(query.get('page', [1])[0]))
                limit = min(50, max(1, int(query.get('limit', [9])[0])))
                offset = (page - 1) * limit

                category_slug = query.get('category', [''])[0].strip()
                tag_slug = query.get('tag', [''])[0].strip()
                search = query.get('search', [''])[0].strip().lower()
                featured = query.get('featured', [''])[0].strip()

                where_clauses = ["p.status = 'published'"]
                params = []

                if category_slug:
                    where_clauses.append("c.slug = ?")
                    params.append(category_slug)

                if tag_slug:
                    where_clauses.append("""
                    p.id IN (
                        SELECT pt.post_id FROM post_tags pt
                        JOIN tags t ON pt.tag_id = t.id
                        WHERE t.slug = ?
                    )
                    """)
                    params.append(tag_slug)

                if search:
                    where_clauses.append("(LOWER(p.title) LIKE ? OR LOWER(p.excerpt) LIKE ? OR LOWER(p.content) LIKE ?)")
                    term = f"%{search}%"
                    params.extend([term, term, term])

                if featured in ('1', 'true'):
                    where_clauses.append("p.is_featured = 1")

                where_sql = " AND ".join(where_clauses)

                # Get total count
                count_query = f"""
                SELECT COUNT(DISTINCT p.id) as total
                FROM posts p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE {where_sql}
                """
                cursor.execute(count_query, params)
                total_posts = cursor.fetchone()['total']

                # Get paginated posts
                posts_query = f"""
                SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image, p.status, p.published_at,
                       p.is_featured, p.views, p.likes_count, p.read_time, p.created_at,
                       c.id as category_id, c.name as category_name, c.slug as category_slug, c.color as category_color,
                       u.id as author_id, u.name as author_name, u.avatar as author_avatar
                FROM posts p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN users u ON p.author_id = u.id
                WHERE {where_sql}
                ORDER BY p.is_featured DESC, p.published_at DESC, p.id DESC
                LIMIT ? OFFSET ?
                """
                cursor.execute(posts_query, params + [limit, offset])
                posts = dict_list_from_rows(cursor.fetchall())

                # Populate tags for each post
                for post in posts:
                    cursor.execute("""
                    SELECT t.id, t.name, t.slug
                    FROM tags t
                    JOIN post_tags pt ON t.id = pt.tag_id
                    WHERE pt.post_id = ?
                    """, (post['id'],))
                    post['tags'] = dict_list_from_rows(cursor.fetchall())

                self.send_json({
                    "posts": posts,
                    "pagination": {
                        "page": page,
                        "limit": limit,
                        "total": total_posts,
                        "total_pages": max(1, (total_posts + limit - 1) // limit)
                    },
                    "success": True
                })
                return

            # GET /api/featured - Spotlight medical posts
            if path == '/api/featured':
                cursor.execute("""
                SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image, p.status, p.published_at,
                       p.is_featured, p.views, p.likes_count, p.read_time,
                       c.name as category_name, c.slug as category_slug, c.color as category_color,
                       u.name as author_name, u.avatar as author_avatar
                FROM posts p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN users u ON p.author_id = u.id
                WHERE p.status = 'published' AND p.is_featured = 1
                ORDER BY p.published_at DESC LIMIT 3
                """)
                featured = dict_list_from_rows(cursor.fetchall())
                self.send_json({"featured": featured, "success": True})
                return

            # GET /api/posts/<slug_or_id> - Single Post Detail
            if path.startswith('/api/posts/'):
                slug_or_id = path[len('/api/posts/'):].strip()
                if slug_or_id.isdigit():
                    cursor.execute("SELECT * FROM posts WHERE id = ?", (int(slug_or_id),))
                else:
                    cursor.execute("SELECT * FROM posts WHERE slug = ?", (slug_or_id,))
                
                post = cursor.fetchone()
                if not post:
                    self.send_error_json("Post not found", 404)
                    return
                
                post_dict = dict_from_row(post)

                # Increment views count
                cursor.execute("UPDATE posts SET views = views + 1 WHERE id = ?", (post_dict['id'],))
                conn.commit()
                post_dict['views'] += 1

                # Category info
                if post_dict['category_id']:
                    cursor.execute("SELECT id, name, slug, color FROM categories WHERE id = ?", (post_dict['category_id'],))
                    post_dict['category'] = dict_from_row(cursor.fetchone())
                else:
                    post_dict['category'] = None

                # Author info
                cursor.execute("SELECT id, name, username, avatar, bio, twitter, github, linkedin FROM users WHERE id = ?", (post_dict['author_id'],))
                post_dict['author'] = dict_from_row(cursor.fetchone())

                # Tags
                cursor.execute("""
                SELECT t.id, t.name, t.slug
                FROM tags t
                JOIN post_tags pt ON t.id = pt.tag_id
                WHERE pt.post_id = ?
                """, (post_dict['id'],))
                post_dict['tags'] = dict_list_from_rows(cursor.fetchall())

                # Comments
                cursor.execute("""
                SELECT id, author_name, author_email, author_avatar, content, created_at
                FROM comments
                WHERE post_id = ? AND is_approved = 1
                ORDER BY id DESC
                """, (post_dict['id'],))
                post_dict['comments'] = dict_list_from_rows(cursor.fetchall())

                # Related Posts
                cursor.execute("""
                SELECT p.id, p.title, p.slug, p.cover_image, p.read_time, p.published_at,
                       c.name as category_name, c.color as category_color
                FROM posts p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.category_id = ? AND p.id != ? AND p.status = 'published'
                ORDER BY p.published_at DESC LIMIT 3
                """, (post_dict['category_id'], post_dict['id']))
                post_dict['related_posts'] = dict_list_from_rows(cursor.fetchall())

                self.send_json({"post": post_dict, "success": True})
                return

            # ========================================================
            # NOTES API (PUBLIC)
            # ========================================================

            # GET /api/notes - Public list of MBBS study notes
            if path == '/api/notes':
                page = max(1, int(query.get('page', [1])[0]))
                limit = min(50, max(1, int(query.get('limit', [12])[0])))
                offset = (page - 1) * limit

                subject = query.get('subject', [''])[0].strip()
                prof_year = query.get('prof_year', [''])[0].strip()
                search = query.get('search', [''])[0].strip().lower()
                high_yield = query.get('high_yield', [''])[0].strip()

                where_clauses = ["status = 'published'"]
                params = []

                if subject:
                    where_clauses.append("LOWER(subject) = LOWER(?)")
                    params.append(subject)

                if prof_year:
                    where_clauses.append("LOWER(prof_year) = LOWER(?)")
                    params.append(prof_year)

                if high_yield in ('1', 'true'):
                    where_clauses.append("is_high_yield = 1")

                if search:
                    where_clauses.append("(LOWER(title) LIKE ? OR LOWER(topic) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(content) LIKE ?)")
                    term = f"%{search}%"
                    params.extend([term, term, term, term])

                where_sql = " AND ".join(where_clauses)

                # Total count
                cursor.execute(f"SELECT COUNT(*) as total FROM notes WHERE {where_sql}", params)
                total_notes = cursor.fetchone()['total']

                # Fetch notes
                notes_sql = f"""
                SELECT id, title, slug, subject, prof_year, topic, summary, download_url,
                       is_high_yield, read_time, views, downloads_count, status, created_at, updated_at
                FROM notes
                WHERE {where_sql}
                ORDER BY is_high_yield DESC, id DESC
                LIMIT ? OFFSET ?
                """
                cursor.execute(notes_sql, params + [limit, offset])
                notes = dict_list_from_rows(cursor.fetchall())

                # Subjects aggregate list with note counts
                cursor.execute("""
                SELECT subject, prof_year, COUNT(*) as count
                FROM notes
                WHERE status = 'published'
                GROUP BY subject, prof_year
                ORDER BY subject ASC
                """)
                subjects_data = dict_list_from_rows(cursor.fetchall())

                self.send_json({
                    "notes": notes,
                    "subjects": subjects_data,
                    "pagination": {
                        "page": page,
                        "limit": limit,
                        "total": total_notes,
                        "total_pages": max(1, (total_notes + limit - 1) // limit)
                    },
                    "success": True
                })
                return

            # GET /api/notes/subjects - Subject directory
            if path == '/api/notes/subjects':
                cursor.execute("""
                SELECT subject, COUNT(*) as count, MAX(prof_year) as prof_year
                FROM notes
                WHERE status = 'published'
                GROUP BY subject
                ORDER BY subject ASC
                """)
                subjects = dict_list_from_rows(cursor.fetchall())
                self.send_json({"subjects": subjects, "success": True})
                return

            # GET /api/notes/<slug_or_id> - Single MBBS Note Detail
            if path.startswith('/api/notes/'):
                slug_or_id = path[len('/api/notes/'):].strip()
                if slug_or_id.isdigit():
                    cursor.execute("SELECT * FROM notes WHERE id = ?", (int(slug_or_id),))
                else:
                    cursor.execute("SELECT * FROM notes WHERE slug = ?", (slug_or_id,))

                note = cursor.fetchone()
                if not note:
                    self.send_error_json("Study note not found", 404)
                    return

                note_dict = dict_from_row(note)

                # Increment views
                cursor.execute("UPDATE notes SET views = views + 1 WHERE id = ?", (note_dict['id'],))
                conn.commit()
                note_dict['views'] += 1

                # Related notes in same subject
                cursor.execute("""
                SELECT id, title, slug, subject, prof_year, topic, is_high_yield, read_time
                FROM notes
                WHERE subject = ? AND id != ? AND status = 'published'
                ORDER BY is_high_yield DESC, id DESC LIMIT 4
                """, (note_dict['subject'], note_dict['id']))
                related = dict_list_from_rows(cursor.fetchall())

                self.send_json({
                    "note": note_dict,
                    "related_notes": related,
                    "success": True
                })
                return

            # GET /api/categories
            if path == '/api/categories':
                cursor.execute("""
                SELECT c.id, c.name, c.slug, c.description, c.color, c.icon,
                       COUNT(p.id) as post_count
                FROM categories c
                LEFT JOIN posts p ON c.id = p.category_id AND p.status = 'published'
                GROUP BY c.id
                ORDER BY c.name ASC
                """)
                categories = dict_list_from_rows(cursor.fetchall())
                self.send_json({"categories": categories, "success": True})
                return

            # GET /api/tags
            if path == '/api/tags':
                cursor.execute("""
                SELECT t.id, t.name, t.slug, COUNT(pt.post_id) as post_count
                FROM tags t
                LEFT JOIN post_tags pt ON t.id = pt.tag_id
                GROUP BY t.id
                ORDER BY post_count DESC, t.name ASC
                """)
                tags = dict_list_from_rows(cursor.fetchall())
                self.send_json({"tags": tags, "success": True})
                return

            # GET /api/authors
            if path == '/api/authors':
                cursor.execute("""
                SELECT u.id, u.name, u.username, u.role, u.avatar, u.bio, u.twitter, u.github, u.linkedin,
                       COUNT(p.id) as post_count
                FROM users u
                LEFT JOIN posts p ON u.id = p.author_id AND p.status = 'published'
                GROUP BY u.id
                """)
                authors = dict_list_from_rows(cursor.fetchall())
                self.send_json({"authors": authors, "success": True})
                return

            # ========================================================
            # ADMIN GET APIS
            # ========================================================
            if path.startswith('/api/admin/'):
                user = self.get_auth_user()
                if not user:
                    self.send_error_json("Unauthorized", 401)
                    return

                # GET /api/admin/stats
                if path == '/api/admin/stats':
                    cursor.execute("SELECT COUNT(*) as total FROM posts")
                    total_posts = cursor.fetchone()['total']

                    cursor.execute("SELECT COUNT(*) as published FROM posts WHERE status = 'published'")
                    published_posts = cursor.fetchone()['published']

                    cursor.execute("SELECT COUNT(*) as draft FROM posts WHERE status = 'draft'")
                    draft_posts = cursor.fetchone()['draft']

                    cursor.execute("SELECT COUNT(*) as scheduled FROM posts WHERE status = 'scheduled'")
                    scheduled_posts = cursor.fetchone()['scheduled']

                    cursor.execute("SELECT COALESCE(SUM(views), 0) as total_views FROM posts")
                    total_views = cursor.fetchone()['total_views']

                    cursor.execute("SELECT COALESCE(SUM(likes_count), 0) as total_likes FROM posts")
                    total_likes = cursor.fetchone()['total_likes']

                    cursor.execute("SELECT COUNT(*) as total_comments FROM comments")
                    total_comments = cursor.fetchone()['total_comments']

                    cursor.execute("SELECT COUNT(*) as total_categories FROM categories")
                    total_categories = cursor.fetchone()['total_categories']

                    cursor.execute("SELECT COUNT(*) as total_subscribers FROM subscribers")
                    total_subscribers = cursor.fetchone()['total_subscribers']

                    # Notes statistics
                    cursor.execute("SELECT COUNT(*) as total FROM notes")
                    total_notes = cursor.fetchone()['total']

                    cursor.execute("SELECT COUNT(*) as published FROM notes WHERE status = 'published'")
                    published_notes = cursor.fetchone()['published']

                    cursor.execute("SELECT COUNT(*) as draft FROM notes WHERE status = 'draft'")
                    draft_notes = cursor.fetchone()['draft']

                    cursor.execute("SELECT COALESCE(SUM(downloads_count), 0) as total_downloads FROM notes")
                    total_note_downloads = cursor.fetchone()['total_downloads']

                    # Recent posts
                    cursor.execute("""
                    SELECT p.id, p.title, p.slug, p.status, p.views, p.likes_count, p.created_at, p.published_at,
                           c.name as category_name, u.name as author_name
                    FROM posts p
                    LEFT JOIN categories c ON p.category_id = c.id
                    LEFT JOIN users u ON p.author_id = u.id
                    ORDER BY p.id DESC LIMIT 5
                    """)
                    recent_posts = dict_list_from_rows(cursor.fetchall())

                    # Recent notes
                    cursor.execute("""
                    SELECT id, title, slug, subject, prof_year, status, views, downloads_count, created_at
                    FROM notes
                    ORDER BY id DESC LIMIT 5
                    """)
                    recent_notes = dict_list_from_rows(cursor.fetchall())

                    # Recent comments
                    cursor.execute("""
                    SELECT cm.id, cm.author_name, cm.author_email, cm.content, cm.is_approved, cm.created_at,
                           p.id as post_id, p.title as post_title, p.slug as post_slug
                    FROM comments cm
                    JOIN posts p ON cm.post_id = p.id
                    ORDER BY cm.id DESC LIMIT 5
                    """)
                    recent_comments = dict_list_from_rows(cursor.fetchall())

                    self.send_json({
                        "stats": {
                            "total_posts": total_posts,
                            "published_posts": published_posts,
                            "draft_posts": draft_posts,
                            "scheduled_posts": scheduled_posts,
                            "total_views": total_views,
                            "total_likes": total_likes,
                            "total_comments": total_comments,
                            "total_categories": total_categories,
                            "total_subscribers": total_subscribers,
                            "total_notes": total_notes,
                            "published_notes": published_notes,
                            "draft_notes": draft_notes,
                            "total_note_downloads": total_note_downloads
                        },
                        "recent_posts": recent_posts,
                        "recent_notes": recent_notes,
                        "recent_comments": recent_comments,
                        "success": True
                    })
                    return

                # GET /api/admin/posts
                if path == '/api/admin/posts':
                    status_filter = query.get('status', ['all'])[0].strip()
                    search = query.get('search', [''])[0].strip().lower()

                    where_clauses = ["1=1"]
                    params = []

                    if status_filter != 'all':
                        where_clauses.append("p.status = ?")
                        params.append(status_filter)

                    if search:
                        where_clauses.append("(LOWER(p.title) LIKE ? OR LOWER(p.slug) LIKE ?)")
                        params.extend([f"%{search}%", f"%{search}%"])

                    sql = f"""
                    SELECT p.id, p.title, p.slug, p.status, p.views, p.likes_count, p.read_time,
                           p.created_at, p.published_at, p.scheduled_at, p.is_featured,
                           c.name as category_name, c.color as category_color,
                           u.name as author_name
                    FROM posts p
                    LEFT JOIN categories c ON p.category_id = c.id
                    LEFT JOIN users u ON p.author_id = u.id
                    WHERE {' AND '.join(where_clauses)}
                    ORDER BY p.id DESC
                    """
                    cursor.execute(sql, params)
                    posts = dict_list_from_rows(cursor.fetchall())
                    self.send_json({"posts": posts, "success": True})
                    return

                # GET /api/admin/notes
                if path == '/api/admin/notes':
                    search = query.get('search', [''])[0].strip().lower()
                    subject = query.get('subject', [''])[0].strip()
                    prof_year = query.get('prof_year', [''])[0].strip()
                    status = query.get('status', ['all'])[0].strip()

                    where_clauses = ["1=1"]
                    params = []

                    if status != 'all':
                        where_clauses.append("n.status = ?")
                        params.append(status)

                    if subject:
                        where_clauses.append("LOWER(n.subject) = LOWER(?)")
                        params.append(subject)

                    if prof_year:
                        where_clauses.append("LOWER(n.prof_year) = LOWER(?)")
                        params.append(prof_year)

                    if search:
                        where_clauses.append("(LOWER(n.title) LIKE ? OR LOWER(n.topic) LIKE ? OR LOWER(n.summary) LIKE ?)")
                        term = f"%{search}%"
                        params.extend([term, term, term])

                    sql = f"""
                    SELECT n.*, u.name as author_name
                    FROM notes n
                    LEFT JOIN users u ON n.author_id = u.id
                    WHERE {' AND '.join(where_clauses)}
                    ORDER BY n.id DESC
                    """
                    cursor.execute(sql, params)
                    notes = dict_list_from_rows(cursor.fetchall())
                    self.send_json({"notes": notes, "success": True})
                    return

                # GET /api/admin/media
                if path == '/api/admin/media':
                    cursor.execute("""
                    SELECT m.*, u.name as uploader_name
                    FROM media m
                    LEFT JOIN users u ON m.uploaded_by = u.id
                    ORDER BY m.id DESC
                    """)
                    media = dict_list_from_rows(cursor.fetchall())
                    self.send_json({"media": media, "success": True})
                    return

                # GET /api/admin/comments
                if path == '/api/admin/comments':
                    cursor.execute("""
                    SELECT cm.*, p.title as post_title, p.slug as post_slug
                    FROM comments cm
                    JOIN posts p ON cm.post_id = p.id
                    ORDER BY cm.id DESC
                    """)
                    comments = dict_list_from_rows(cursor.fetchall())
                    self.send_json({"comments": comments, "success": True})
                    return

                # GET /api/admin/messages
                if path == '/api/admin/messages':
                    cursor.execute("SELECT * FROM contact_messages ORDER BY id DESC")
                    messages = dict_list_from_rows(cursor.fetchall())
                    self.send_json({"messages": messages, "success": True})
                    return

                # GET /api/admin/categories
                if path == '/api/admin/categories':
                    cursor.execute("""
                    SELECT c.*, COUNT(p.id) as post_count
                    FROM categories c
                    LEFT JOIN posts p ON c.id = p.category_id
                    GROUP BY c.id
                    ORDER BY c.name ASC
                    """)
                    cats = dict_list_from_rows(cursor.fetchall())
                    self.send_json({"categories": cats, "success": True})
                    return

                # GET /api/admin/tags
                if path == '/api/admin/tags':
                    cursor.execute("""
                    SELECT t.*, COUNT(pt.post_id) as post_count
                    FROM tags t
                    LEFT JOIN post_tags pt ON t.id = pt.tag_id
                    GROUP BY t.id
                    ORDER BY t.name ASC
                    """)
                    tags = dict_list_from_rows(cursor.fetchall())
                    self.send_json({"tags": tags, "success": True})
                    return

            self.send_error_json("Endpoint not found", 404)

        except Exception as e:
            sys.stderr.write(f"API GET Error: {e}\n")
            self.send_error_json(str(e), 500)
        finally:
            conn.close()

    def do_POST(self):
        """Handle POST requests for authentication, comments, notes, posts, and contact inquiries."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path.rstrip('/') if parsed_url.path != '/' else '/'

        client_ip = self.get_client_ip()
        conn = get_db()
        cursor = conn.cursor()

        try:
            # POST /api/auth/login
            if path == '/api/auth/login':
                # Check rate limit
                allowed, remaining = check_login_rate_limit(client_ip)
                if not allowed:
                    self.send_error_json(
                        f"Too many failed login attempts. Locked for security. Please try again after {remaining} seconds.",
                        429
                    )
                    return

                data = self.parse_body_json()
                if not data:
                    self.send_error_json("Invalid JSON payload", 400)
                    return

                login_id = (data.get('email') or data.get('username') or '').strip().lower()
                password = data.get('password') or ''

                if not login_id or not password:
                    self.send_error_json("Username/email and password are required", 400)
                    return

                # Query user by username or email
                cursor.execute("SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?", (login_id, login_id))
                user = cursor.fetchone()

                expected_hash = hash_password(password)
                if not user or not hmac.compare_digest(user['password_hash'], expected_hash):
                    record_failed_login(client_ip)
                    self.send_error_json("Invalid username/email or password", 401)
                    return

                # Reset rate limit on successful authentication
                reset_failed_login(client_ip)

                # Generate secure session token
                token = secrets.token_hex(32)
                expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S')

                cursor.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
                               (token, user['id'], expires_at))
                conn.commit()

                user_dict = dict_from_row(user)
                del user_dict['password_hash']

                self.send_json({
                    "success": True,
                    "token": token,
                    "user": user_dict,
                    "message": "Login successful"
                }, cookie_token=token)
                return

            # POST /api/auth/logout
            if path == '/api/auth/logout':
                token = None
                auth_header = self.headers.get('Authorization')
                if auth_header and auth_header.startswith('Bearer '):
                    token = auth_header.split(' ', 1)[1].strip()
                if token:
                    cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
                    conn.commit()
                self.send_json({"success": True, "message": "Logged out successfully"})
                return

            # POST /api/posts/<id>/like
            if path.startswith('/api/posts/') and path.endswith('/like'):
                parts = path.split('/')
                post_id = int(parts[3])
                ip_hash = hashlib.sha256(client_ip.encode('utf-8')).hexdigest()

                try:
                    cursor.execute("INSERT INTO post_likes (post_id, ip_hash) VALUES (?, ?)", (post_id, ip_hash))
                    cursor.execute("UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?", (post_id,))
                    conn.commit()

                    cursor.execute("SELECT likes_count FROM posts WHERE id = ?", (post_id,))
                    new_likes = cursor.fetchone()['likes_count']
                    self.send_json({"success": True, "likes_count": new_likes, "liked": True})
                except sqlite3.IntegrityError:
                    cursor.execute("SELECT likes_count FROM posts WHERE id = ?", (post_id,))
                    current_likes = cursor.fetchone()['likes_count']
                    self.send_json({"success": True, "likes_count": current_likes, "liked": True, "already_liked": True})
                return

            # POST /api/notes/<id>/download - Increment download count
            if path.startswith('/api/notes/') and path.endswith('/download'):
                parts = path.split('/')
                note_id = int(parts[3])
                cursor.execute("UPDATE notes SET downloads_count = downloads_count + 1 WHERE id = ?", (note_id,))
                conn.commit()
                cursor.execute("SELECT download_url, downloads_count FROM notes WHERE id = ?", (note_id,))
                row = cursor.fetchone()
                self.send_json({
                    "success": True,
                    "download_url": row['download_url'] if row else None,
                    "downloads_count": row['downloads_count'] if row else 0
                })
                return

            # POST /api/posts/<id>/comments - Submit comment
            if path.startswith('/api/posts/') and path.endswith('/comments'):
                parts = path.split('/')
                post_id = int(parts[3])
                data = self.parse_body_json()
                if not data:
                    self.send_error_json("Invalid comment payload", 400)
                    return

                author_name = (data.get('name') or '').strip()
                author_email = (data.get('email') or '').strip()
                content = (data.get('content') or '').strip()

                if not author_name or not author_email or not content:
                    self.send_error_json("Name, email, and comment are required", 400)
                    return

                # Gravatar or default avatar
                email_hash = hashlib.md5(author_email.lower().encode('utf-8')).hexdigest()
                avatar = f"https://www.gravatar.com/avatar/{email_hash}?d=identicon"

                cursor.execute('''
                INSERT INTO comments (post_id, author_name, author_email, author_avatar, content, is_approved)
                VALUES (?, ?, ?, ?, ?, 1)
                ''', (post_id, author_name, author_email, avatar, content))
                conn.commit()

                comment_id = cursor.lastrowid
                self.send_json({
                    "success": True,
                    "comment": {
                        "id": comment_id,
                        "post_id": post_id,
                        "author_name": author_name,
                        "author_avatar": avatar,
                        "content": content,
                        "created_at": datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
                    },
                    "message": "Comment posted successfully!"
                })
                return

            # POST /api/newsletter - Subscribe
            if path == '/api/newsletter':
                data = self.parse_body_json()
                email = (data.get('email') or '').strip().lower()
                if not email or '@' not in email:
                    self.send_error_json("Valid email address is required", 400)
                    return

                try:
                    cursor.execute("INSERT INTO subscribers (email) VALUES (?)", (email,))
                    conn.commit()
                    self.send_json({"success": True, "message": "Subscribed to Medo Medical High-Yield Digest!"})
                except sqlite3.IntegrityError:
                    self.send_json({"success": True, "message": "You are already subscribed to Medo!"})
                return

            # POST /api/contact - Medical Inquiry Form
            if path == '/api/contact':
                data = self.parse_body_json()
                name = (data.get('name') or '').strip()
                email = (data.get('email') or '').strip()
                subject = (data.get('subject') or '').strip()
                category = (data.get('category') or 'general').strip()
                message = (data.get('message') or '').strip()

                if not name or not email or not message:
                    self.send_error_json("Name, email, and message are required", 400)
                    return

                cursor.execute('''
                INSERT INTO contact_messages (name, email, subject, category, message)
                VALUES (?, ?, ?, ?, ?)
                ''', (name, email, subject, category, message))
                conn.commit()
                self.send_json({"success": True, "message": "Thank you! Your message has been received."})
                return

            # ========================================================
            # ADMIN PROTECTED POST ENDPOINTS
            # ========================================================
            if path.startswith('/api/admin/'):
                user = self.get_auth_user()
                if not user:
                    self.send_error_json("Unauthorized", 401)
                    return

                # POST /api/admin/posts - Create Post (Blog)
                if path == '/api/admin/posts':
                    data = self.parse_body_json()
                    if not data:
                        self.send_error_json("Invalid post payload", 400)
                        return

                    title = (data.get('title') or '').strip()
                    if not title:
                        self.send_error_json("Post title is required", 400)
                        return

                    slug = (data.get('slug') or '').strip()
                    if not slug:
                        slug = generate_slug(title)
                    else:
                        slug = generate_slug(slug)

                    # Ensure unique slug
                    cursor.execute("SELECT id FROM posts WHERE slug = ?", (slug,))
                    if cursor.fetchone():
                        slug = f"{slug}-{int(time.time())}"

                    excerpt = (data.get('excerpt') or '').strip()
                    content = (data.get('content') or '').strip()
                    cover_image = (data.get('cover_image') or '').strip()
                    category_id = data.get('category_id')
                    author_id = data.get('author_id') or user['id']
                    status = data.get('status', 'draft')
                    is_featured = 1 if data.get('is_featured') else 0
                    scheduled_at = data.get('scheduled_at')
                    
                    published_at = None
                    if status == 'published':
                        published_at = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')

                    read_time = calculate_reading_time(content)
                    meta_title = (data.get('meta_title') or title).strip()
                    meta_description = (data.get('meta_description') or excerpt).strip()
                    meta_keywords = (data.get('meta_keywords') or '').strip()

                    cursor.execute('''
                    INSERT INTO posts (
                        title, slug, excerpt, content, cover_image, author_id, category_id,
                        status, scheduled_at, published_at, is_featured, read_time,
                        meta_title, meta_description, meta_keywords, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ''', (
                        title, slug, excerpt, content, cover_image, author_id, category_id,
                        status, scheduled_at, published_at, is_featured, read_time,
                        meta_title, meta_description, meta_keywords
                    ))
                    post_id = cursor.lastrowid

                    tag_ids = data.get('tag_ids', [])
                    for tid in tag_ids:
                        cursor.execute("INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)", (post_id, tid))

                    conn.commit()
                    self.send_json({"success": True, "post_id": post_id, "slug": slug, "message": "Medical blog created successfully!"})
                    return

                # POST /api/admin/notes - Create Study Note
                if path == '/api/admin/notes':
                    data = self.parse_body_json()
                    if not data:
                        self.send_error_json("Invalid note payload", 400)
                        return

                    title = (data.get('title') or '').strip()
                    if not title:
                        self.send_error_json("Note title is required", 400)
                        return

                    slug = (data.get('slug') or '').strip()
                    if not slug:
                        slug = generate_slug(title)
                    else:
                        slug = generate_slug(slug)

                    # Ensure unique slug
                    cursor.execute("SELECT id FROM notes WHERE slug = ?", (slug,))
                    if cursor.fetchone():
                        slug = f"{slug}-{int(time.time())}"

                    subject = (data.get('subject') or 'General Medicine').strip()
                    prof_year = (data.get('prof_year') or '1st Prof').strip()
                    topic = (data.get('topic') or '').strip()
                    summary = (data.get('summary') or '').strip()
                    content = (data.get('content') or '').strip()
                    download_url = (data.get('download_url') or '').strip()
                    is_high_yield = 1 if data.get('is_high_yield') else 0
                    status = data.get('status', 'published')
                    read_time = calculate_reading_time(content)

                    cursor.execute('''
                    INSERT INTO notes (
                        title, slug, subject, prof_year, topic, summary, content,
                        download_url, is_high_yield, read_time, status, author_id,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ''', (
                        title, slug, subject, prof_year, topic, summary, content,
                        download_url, is_high_yield, read_time, status, user['id']
                    ))
                    note_id = cursor.lastrowid
                    conn.commit()

                    self.send_json({"success": True, "note_id": note_id, "slug": slug, "message": "Study note created successfully!"})
                    return

                # POST /api/admin/posts/<id>/duplicate
                if path.startswith('/api/admin/posts/') and path.endswith('/duplicate'):
                    parts = path.split('/')
                    source_id = int(parts[4])
                    cursor.execute("SELECT * FROM posts WHERE id = ?", (source_id,))
                    orig = cursor.fetchone()
                    if not orig:
                        self.send_error_json("Original post not found", 404)
                        return

                    dup_title = f"{orig['title']} (Copy)"
                    dup_slug = f"{orig['slug']}-copy-{int(time.time())}"

                    cursor.execute('''
                    INSERT INTO posts (
                        title, slug, excerpt, content, cover_image, author_id, category_id,
                        status, is_featured, read_time, meta_title, meta_description, meta_keywords
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, ?, ?, ?)
                    ''', (
                        dup_title, dup_slug, orig['excerpt'], orig['content'], orig['cover_image'],
                        user['id'], orig['category_id'], orig['read_time'], orig['meta_title'],
                        orig['meta_description'], orig['meta_keywords']
                    ))
                    dup_id = cursor.lastrowid

                    # Copy tags
                    cursor.execute("SELECT tag_id FROM post_tags WHERE post_id = ?", (source_id,))
                    tags = cursor.fetchall()
                    for t in tags:
                        cursor.execute("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)", (dup_id, t['tag_id']))

                    conn.commit()
                    self.send_json({"success": True, "post_id": dup_id, "message": "Post duplicated as draft!"})
                    return

                # POST /api/admin/categories - Create Category
                if path == '/api/admin/categories':
                    data = self.parse_body_json()
                    name = (data.get('name') or '').strip()
                    if not name:
                        self.send_error_json("Category name is required", 400)
                        return

                    slug = (data.get('slug') or '').strip() or generate_slug(name)
                    desc = (data.get('description') or '').strip()
                    color = (data.get('color') or '#0284C7').strip()
                    icon = (data.get('icon') or 'activity').strip()

                    try:
                        cursor.execute("INSERT INTO categories (name, slug, description, color, icon) VALUES (?, ?, ?, ?, ?)",
                                       (name, slug, desc, color, icon))
                        conn.commit()
                        cat_id = cursor.lastrowid
                        self.send_json({"success": True, "category_id": cat_id, "message": "Category created successfully!"})
                    except sqlite3.IntegrityError:
                        self.send_error_json("Category name or slug already exists", 400)
                    return

                # POST /api/admin/tags - Create Tag
                if path == '/api/admin/tags':
                    data = self.parse_body_json()
                    name = (data.get('name') or '').strip()
                    if not name:
                        self.send_error_json("Tag name is required", 400)
                        return

                    slug = (data.get('slug') or '').strip() or generate_slug(name)
                    try:
                        cursor.execute("INSERT INTO tags (name, slug) VALUES (?, ?)", (name, slug))
                        conn.commit()
                        tag_id = cursor.lastrowid
                        self.send_json({"success": True, "tag_id": tag_id, "message": "Tag created successfully!"})
                    except sqlite3.IntegrityError:
                        self.send_error_json("Tag name or slug already exists", 400)
                    return

                # POST /api/admin/upload - Base64 or URL media upload
                if path == '/api/admin/upload':
                    data = self.parse_body_json()
                    if not data:
                        self.send_error_json("Invalid upload payload", 400)
                        return

                    if 'base64' in data and data['base64']:
                        raw_b64 = data['base64']
                        filename = (data.get('filename') or f"upload_{int(time.time())}.jpg").strip()
                        alt_text = (data.get('alt_text') or filename).strip()
                        
                        header, base64_data = (raw_b64.split(',', 1)) if ',' in raw_b64 else ('', raw_b64)
                        file_bytes = base64.b64decode(base64_data)
                        
                        ext = os.path.splitext(filename)[1] or '.jpg'
                        safe_name = f"media_{secrets.token_hex(8)}{ext}"
                        target_path = os.path.join(UPLOADS_DIR, safe_name)
                        
                        with open(target_path, 'wb') as f:
                            f.write(file_bytes)

                        file_url = f"/uploads/{safe_name}"
                        file_size = len(file_bytes)
                        mime_type = mimetypes.guess_type(safe_name)[0] or 'image/jpeg'

                        cursor.execute('''
                        INSERT INTO media (filename, original_name, file_path, url, file_size, mime_type, alt_text, uploaded_by)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (safe_name, filename, target_path, file_url, file_size, mime_type, alt_text, user['id']))
                        conn.commit()
                        media_id = cursor.lastrowid

                        self.send_json({
                            "success": True,
                            "media": {
                                "id": media_id,
                                "url": file_url,
                                "filename": safe_name,
                                "original_name": filename,
                                "alt_text": alt_text
                            },
                            "message": "Media uploaded successfully!"
                        })
                        return

                    if 'url' in data and data['url']:
                        url = data['url'].strip()
                        name = (data.get('name') or url.split('/')[-1] or "image.jpg").split('?')[0]
                        alt_text = (data.get('alt_text') or name).strip()

                        cursor.execute('''
                        INSERT INTO media (filename, original_name, file_path, url, file_size, mime_type, alt_text, uploaded_by)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (name, name, "external", url, 0, "image/jpeg", alt_text, user['id']))
                        conn.commit()
                        media_id = cursor.lastrowid

                        self.send_json({
                            "success": True,
                            "media": {
                                "id": media_id,
                                "url": url,
                                "filename": name,
                                "original_name": name,
                                "alt_text": alt_text
                            },
                            "message": "Media reference saved!"
                        })
                        return

                    self.send_error_json("No image data or URL provided", 400)
                    return

            self.send_error_json("Endpoint not found", 404)

        except Exception as e:
            sys.stderr.write(f"API POST Error: {e}\n")
            self.send_error_json(str(e), 500)
        finally:
            conn.close()

    def do_PUT(self):
        """Handle PUT requests for updating posts, notes, categories, profiles, comments, messages."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path.rstrip('/') if parsed_url.path != '/' else '/'

        user = self.get_auth_user()
        if not user:
            self.send_error_json("Unauthorized", 401)
            return

        conn = get_db()
        cursor = conn.cursor()

        try:
            # PUT /api/auth/profile
            if path == '/api/auth/profile':
                data = self.parse_body_json()
                if not data:
                    self.send_error_json("Invalid profile payload", 400)
                    return

                name = (data.get('name') or user['name']).strip()
                avatar = (data.get('avatar') or user['avatar']).strip()
                bio = (data.get('bio') or '').strip()
                twitter = (data.get('twitter') or '').strip()
                github = (data.get('github') or '').strip()
                linkedin = (data.get('linkedin') or '').strip()
                new_password = (data.get('new_password') or '').strip()

                if new_password:
                    pass_hash = hash_password(new_password)
                    cursor.execute('''
                    UPDATE users SET name = ?, avatar = ?, bio = ?, twitter = ?, github = ?, linkedin = ?, password_hash = ?
                    WHERE id = ?
                    ''', (name, avatar, bio, twitter, github, linkedin, pass_hash, user['id']))
                else:
                    cursor.execute('''
                    UPDATE users SET name = ?, avatar = ?, bio = ?, twitter = ?, github = ?, linkedin = ?
                    WHERE id = ?
                    ''', (name, avatar, bio, twitter, github, linkedin, user['id']))

                conn.commit()
                cursor.execute("SELECT id, name, username, email, role, avatar, bio, twitter, github, linkedin FROM users WHERE id = ?", (user['id'],))
                updated_user = dict_from_row(cursor.fetchone())

                self.send_json({"success": True, "user": updated_user, "message": "Profile updated successfully!"})
                return

            # PUT /api/admin/posts/<id>
            if path.startswith('/api/admin/posts/'):
                post_id_str = path[len('/api/admin/posts/'):].strip()
                if not post_id_str.isdigit():
                    self.send_error_json("Invalid post ID", 400)
                    return
                post_id = int(post_id_str)
                data = self.parse_body_json()
                if not data:
                    self.send_error_json("Invalid update payload", 400)
                    return

                cursor.execute("SELECT * FROM posts WHERE id = ?", (post_id,))
                existing = cursor.fetchone()
                if not existing:
                    self.send_error_json("Post not found", 404)
                    return

                title = (data.get('title') or existing['title']).strip()
                if 'slug' in data and data['slug']:
                    slug = generate_slug(data['slug'])
                elif 'title' in data and data['title'] and not existing['slug']:
                    slug = generate_slug(data['title'])
                else:
                    slug = existing['slug']
                
                cursor.execute("SELECT id FROM posts WHERE slug = ? AND id != ?", (slug, post_id))
                if cursor.fetchone():
                    slug = f"{slug}-{int(time.time())}"

                excerpt = data.get('excerpt', existing['excerpt'])
                content = data.get('content', existing['content'])
                cover_image = data.get('cover_image', existing['cover_image'])
                category_id = data.get('category_id', existing['category_id'])
                author_id = data.get('author_id', existing['author_id'])
                status = data.get('status', existing['status'])
                
                if 'is_featured' in data:
                    is_featured = 1 if data['is_featured'] else 0
                else:
                    is_featured = existing['is_featured']

                scheduled_at = data.get('scheduled_at', existing['scheduled_at'])

                published_at = existing['published_at']
                if status == 'published' and not published_at:
                    published_at = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')

                read_time = calculate_reading_time(content)
                meta_title = data.get('meta_title', existing['meta_title'])
                meta_description = data.get('meta_description', existing['meta_description'])
                meta_keywords = data.get('meta_keywords', existing['meta_keywords'])

                cursor.execute('''
                UPDATE posts SET
                    title = ?, slug = ?, excerpt = ?, content = ?, cover_image = ?,
                    author_id = ?, category_id = ?, status = ?, scheduled_at = ?,
                    published_at = ?, is_featured = ?, read_time = ?, meta_title = ?,
                    meta_description = ?, meta_keywords = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                ''', (
                    title, slug, excerpt, content, cover_image,
                    author_id, category_id, status, scheduled_at,
                    published_at, is_featured, read_time, meta_title,
                    meta_description, meta_keywords, post_id
                ))

                if 'tag_ids' in data:
                    cursor.execute("DELETE FROM post_tags WHERE post_id = ?", (post_id,))
                    for tid in data['tag_ids']:
                        cursor.execute("INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)", (post_id, tid))

                conn.commit()
                self.send_json({"success": True, "message": "Post updated successfully!", "slug": slug})
                return

            # PUT /api/admin/notes/<id>
            if path.startswith('/api/admin/notes/'):
                note_id_str = path[len('/api/admin/notes/'):].strip()
                if not note_id_str.isdigit():
                    self.send_error_json("Invalid note ID", 400)
                    return
                note_id = int(note_id_str)
                data = self.parse_body_json()
                if not data:
                    self.send_error_json("Invalid update payload", 400)
                    return

                cursor.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
                existing = cursor.fetchone()
                if not existing:
                    self.send_error_json("Study note not found", 404)
                    return

                title = (data.get('title') or existing['title']).strip()
                if 'slug' in data and data['slug']:
                    slug = generate_slug(data['slug'])
                else:
                    slug = existing['slug']

                cursor.execute("SELECT id FROM notes WHERE slug = ? AND id != ?", (slug, note_id))
                if cursor.fetchone():
                    slug = f"{slug}-{int(time.time())}"

                subject = (data.get('subject') or existing['subject']).strip()
                prof_year = (data.get('prof_year') or existing['prof_year']).strip()
                topic = (data.get('topic') or existing['topic'] or '').strip()
                summary = (data.get('summary') or existing['summary'] or '').strip()
                content = (data.get('content') or existing['content'] or '').strip()
                download_url = data.get('download_url', existing['download_url'])
                is_high_yield = 1 if data.get('is_high_yield', existing['is_high_yield']) else 0
                status = data.get('status', existing['status'])
                read_time = calculate_reading_time(content)

                cursor.execute('''
                UPDATE notes SET
                    title = ?, slug = ?, subject = ?, prof_year = ?, topic = ?,
                    summary = ?, content = ?, download_url = ?, is_high_yield = ?,
                    read_time = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                ''', (
                    title, slug, subject, prof_year, topic,
                    summary, content, download_url, is_high_yield,
                    read_time, status, note_id
                ))
                conn.commit()
                self.send_json({"success": True, "message": "Study note updated successfully!", "slug": slug})
                return

            # PUT /api/admin/categories/<id>
            if path.startswith('/api/admin/categories/'):
                cat_id = int(path.split('/')[-1])
                data = self.parse_body_json()
                name = (data.get('name') or '').strip()
                slug = (data.get('slug') or '').strip() or generate_slug(name)
                desc = (data.get('description') or '').strip()
                color = (data.get('color') or '#0284C7').strip()
                icon = (data.get('icon') or 'activity').strip()

                cursor.execute('''
                UPDATE categories SET name = ?, slug = ?, description = ?, color = ?, icon = ?
                WHERE id = ?
                ''', (name, slug, desc, color, icon, cat_id))
                conn.commit()
                self.send_json({"success": True, "message": "Category updated successfully!"})
                return

            # PUT /api/admin/tags/<id>
            if path.startswith('/api/admin/tags/'):
                tag_id = int(path.split('/')[-1])
                data = self.parse_body_json()
                name = (data.get('name') or '').strip()
                slug = (data.get('slug') or '').strip() or generate_slug(name)

                cursor.execute("UPDATE tags SET name = ?, slug = ? WHERE id = ?", (name, slug, tag_id))
                conn.commit()
                self.send_json({"success": True, "message": "Tag updated successfully!"})
                return

            # PUT /api/admin/comments/<id>
            if path.startswith('/api/admin/comments/'):
                comment_id = int(path.split('/')[-1])
                data = self.parse_body_json()
                is_approved = 1 if data.get('is_approved') else 0

                cursor.execute("UPDATE comments SET is_approved = ? WHERE id = ?", (is_approved, comment_id))
                conn.commit()
                self.send_json({"success": True, "message": "Comment status updated"})
                return

            # PUT /api/admin/messages/<id>/read
            if path.startswith('/api/admin/messages/') and path.endswith('/read'):
                msg_id = int(path.split('/')[4])
                cursor.execute("UPDATE contact_messages SET is_read = 1 WHERE id = ?", (msg_id,))
                conn.commit()
                self.send_json({"success": True, "message": "Message marked as read"})
                return

            self.send_error_json("Endpoint not found", 404)

        except Exception as e:
            sys.stderr.write(f"API PUT Error: {e}\n")
            self.send_error_json(str(e), 500)
        finally:
            conn.close()

    def do_DELETE(self):
        """Handle DELETE requests for posts, notes, categories, tags, media, comments, messages."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path.rstrip('/') if parsed_url.path != '/' else '/'

        user = self.get_auth_user()
        if not user:
            self.send_error_json("Unauthorized", 401)
            return

        conn = get_db()
        cursor = conn.cursor()

        try:
            # DELETE /api/admin/posts/<id>
            if path.startswith('/api/admin/posts/'):
                post_id = int(path.split('/')[-1])
                cursor.execute("DELETE FROM posts WHERE id = ?", (post_id,))
                conn.commit()
                self.send_json({"success": True, "message": "Post deleted successfully"})
                return

            # DELETE /api/admin/notes/<id>
            if path.startswith('/api/admin/notes/'):
                note_id = int(path.split('/')[-1])
                cursor.execute("DELETE FROM notes WHERE id = ?", (note_id,))
                conn.commit()
                self.send_json({"success": True, "message": "Study note deleted successfully"})
                return

            # DELETE /api/admin/categories/<id>
            if path.startswith('/api/admin/categories/'):
                cat_id = int(path.split('/')[-1])
                cursor.execute("DELETE FROM categories WHERE id = ?", (cat_id,))
                conn.commit()
                self.send_json({"success": True, "message": "Category deleted successfully"})
                return

            # DELETE /api/admin/tags/<id>
            if path.startswith('/api/admin/tags/'):
                tag_id = int(path.split('/')[-1])
                cursor.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
                conn.commit()
                self.send_json({"success": True, "message": "Tag deleted successfully"})
                return

            # DELETE /api/admin/media/<id>
            if path.startswith('/api/admin/media/'):
                media_id = int(path.split('/')[-1])
                cursor.execute("SELECT file_path FROM media WHERE id = ?", (media_id,))
                row = cursor.fetchone()
                if row and row['file_path'] and os.path.exists(row['file_path']) and row['file_path'] != 'external':
                    try:
                        os.remove(row['file_path'])
                    except Exception:
                        pass
                cursor.execute("DELETE FROM media WHERE id = ?", (media_id,))
                conn.commit()
                self.send_json({"success": True, "message": "Media deleted successfully"})
                return

            # DELETE /api/admin/comments/<id>
            if path.startswith('/api/admin/comments/'):
                comment_id = int(path.split('/')[-1])
                cursor.execute("DELETE FROM comments WHERE id = ?", (comment_id,))
                conn.commit()
                self.send_json({"success": True, "message": "Comment deleted successfully"})
                return

            # DELETE /api/admin/messages/<id>
            if path.startswith('/api/admin/messages/'):
                msg_id = int(path.split('/')[-1])
                cursor.execute("DELETE FROM contact_messages WHERE id = ?", (msg_id,))
                conn.commit()
                self.send_json({"success": True, "message": "Message deleted successfully"})
                return

            self.send_error_json("Endpoint not found", 404)

        except Exception as e:
            sys.stderr.write(f"API DELETE Error: {e}\n")
            self.send_error_json(str(e), 500)
        finally:
            conn.close()

def run_server():
    """Start threaded HTTP server."""
    init_db()
    server_address = ('', PORT)
    httpd = ThreadingHTTPServer(server_address, MedoServerHandler)
    print("=" * 60)
    print(f"🩺 Medo — MBBS Student Blog & Notes Platform Server")
    print(f"⚡ Listening on http://localhost:{PORT}")
    print(f"🔒 Admin Login: anuja2007 (Credentials secured in backend DB)")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Medo server gracefully...")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
