# Medo — The MBBS Student Medical Blog & High-Yield Notes Platform

**Medo** is a modern full-stack medical student editorial platform and content management system tailored for MBBS students, clinical residents, and healthcare scholars. It features clinical guides, ward survival reflections, an Anki spaced-repetition workflow, and a dedicated **Study Notes Hub** with high-yield exam pearls organized across all university professional years.

---

## 🩺 System Architecture

- **Backend**: Python 3 multithreaded REST API server (`server.py`) with hardened web security headers and brute-force protection.
- **Database**: SQLite WAL-mode persistent database (`database.py` / `medo.db`) with foreign keys and parameterized queries.
- **Frontend**: Clean, responsive Single Page Application (SPA) with Tailwind CSS, Lucide icons, Marked.js, and Highlight.js.
- **Security**: 
  - Salted PBKDF2-HMAC-SHA256 password hashing (100,000 iterations).
  - Timing attack-safe verification with `hmac.compare_digest`.
  - In-memory IP rate limiter locking out brute-force attempts after 5 failures.
  - No credentials or sensitive secrets exposed in client-side code.
  - Strict security headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Content-Security-Policy`).

---

## 🌟 Key Features

### 📖 Student & Reader Experience
- **Editorial Medical Homepage**:
  - Spotlight clinical guide banner.
  - Quick-access **Study Notes Hub** banner.
  - Medical discipline filters (Anatomy, Physiology, Pharmacology, Pathology, Medicine, Surgery, Med School Life).
  - Search bar and tag filtering.
  - Article cards with reading times, views, likes, and author badges.
  - Weekly high-yield newsletter dispatch subscription.
- **⚡ Dedicated Study Notes Panel (`/notes`)**:
  - Filter by **Professional Year**: All Years, 1st Prof, 2nd Prof, 3rd Prof, Final Prof.
  - Filter by **Medical Subject**: Anatomy, Physiology, Biochemistry, Pharmacology, Pathology, Microbiology, General Medicine, General Surgery, OBG, Pediatrics, etc.
  - Instant real-time keyword search.
  - **⚡ High-Yield Exam Pearls Only** toggle filter.
  - Detailed Note View (`/notes/<slug>`):
    - Clinical recall callout box with key takeaways.
    - Full markdown note reader with diagnostic tables and mnemonics.
    - 1-click resource / PDF download action with download analytics.
    - Related notes in the same medical discipline.
- **Clinical Articles (`/posts/<slug>`)**:
  - Reading progress bar.
  - Markdown content with tables and medical mnemonics.
  - Interactive Like reaction.
  - Reader comments and clinical discussions.
- **Curriculum Directory (`/categories`)**:
  - Overview of all MBBS subjects and article counts.
- **About Medo (`/about`)**:
  - Founder story: Dr. Anuja (MBBS Scholar & Clinical Resident).
  - Core philosophy: active recall, spaced repetition, Anki-first learning, bedside clinical synthesis.
- **Contact Desk (`/contact`)**:
  - Student inquiries, case study submissions, and note suggestions.
- **Global Search (`Cmd+K` / `Ctrl+K`)**:
  - Instant modal searching both medical articles and study notes.

---

### 🔒 Admin CMS & Content Management (`/admin`)

- **Secure Authentication**:
  - Username: `anuja2007` (or email: `anuja2007@medo.com`)
  - Password: `anuskar2020@`
  - Zero hardcoded demo credentials in UI.
  - Show/Hide password toggle.
- **Admin Dashboard**:
  - Key metrics: Total Notes, Total Blogs, Total Views, Reader Likes, Note Downloads, Subscribers.
  - Quick actions: "+ Post Study Note" and "+ Post Medical Blog".
  - Recent Notes and Recent Blogs moderation tables.
- **Study Notes Management (`/admin/notes`)**:
  - List and filter notes by Subject, Prof Year, or Status.
  - **Note Composer & Editor (`/admin/notes/new` & `/admin/notes/edit/<id>`)**:
    - Note Title & URL Slug.
    - Subject & Prof Year selectors.
    - Topic / Sub-specialty.
    - ⚡ Mark as High-Yield Pearl checkbox.
    - Summary & key revision takeaways.
    - Full Markdown note editor with live split-screen preview.
    - Download / PDF resource URL attachment.
    - Status management: `Published` or `Draft`.
- **Medical Blogs Management (`/admin/posts`)**:
  - Compose, edit, duplicate, and schedule medical blog posts.
- **Curriculum & Assets**:
  - Medical Subjects & Tags manager.
  - Media Library for clinical illustrations and diagrams.
  - Reader comments moderation.
  - Inquiries inbox.
  - Profile & Admin password settings.

---

## 🚀 Quick Start

### 1. Start the Server
```bash
./run.sh
```
or directly with Python:
```bash
python3 database.py
python3 server.py
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser.

### 2. Admin Panel Login
Navigate to **[http://localhost:8080/admin/login](http://localhost:8080/admin/login)**:
- **Username**: `anuja2007` (or `anuja2007@medo.com`)
- **Password**: `anuskar2020@`

### 3. Run Automated Verification Test Suite
```bash
python3 test_medo.py
```
Verifies database integrity, authentication, rate limiting, notes CRUD, API endpoints, and credential privacy.
