"""
Database module for Medo — The MBBS Student Blog & Notes Platform
Handles SQLite schema, connection management, queries, security, and medical seed data.
"""

import sqlite3
import os
import hashlib
import secrets
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), 'medo.db')
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), 'uploads')

os.makedirs(UPLOADS_DIR, exist_ok=True)

# Secure password salt
SALT = b"medo_mbbs_secure_salt_2026_x#"

def hash_password(password: str) -> str:
    """Hash password using PBKDF2 with SHA-256 (100,000 iterations)."""
    if not password:
        return ""
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), SALT, 100000)
    return key.hex()

def get_db():
    """Get database connection with row factory, connection timeout, and WAL mode."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

def init_db():
    """Initialize database tables and seed initial medical content if empty."""
    conn = get_db()
    cursor = conn.cursor()

    # Create Users table (with username column for anuja2007 login)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        avatar TEXT,
        bio TEXT,
        twitter TEXT,
        github TEXT,
        linkedin TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    ''')

    # Create Categories table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#0284C7',
        icon TEXT DEFAULT 'folder',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    ''')

    # Create Tags table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    ''')

    # Create Posts (Blogs) table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        excerpt TEXT,
        content TEXT NOT NULL,
        cover_image TEXT,
        author_id INTEGER NOT NULL,
        category_id INTEGER,
        status TEXT DEFAULT 'draft',
        scheduled_at DATETIME,
        published_at DATETIME,
        is_featured INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        likes_count INTEGER DEFAULT 0,
        read_time INTEGER DEFAULT 5,
        meta_title TEXT,
        meta_description TEXT,
        meta_keywords TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
    );
    ''')

    # Create Study Notes table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        subject TEXT NOT NULL,
        prof_year TEXT NOT NULL,
        topic TEXT,
        summary TEXT NOT NULL,
        content TEXT NOT NULL,
        download_url TEXT,
        is_high_yield INTEGER DEFAULT 0,
        read_time INTEGER DEFAULT 5,
        views INTEGER DEFAULT 0,
        downloads_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'published',
        author_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL
    );
    ''')

    # Create Post Tags junction table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS post_tags (
        post_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (post_id, tag_id),
        FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
    );
    ''')

    # Create Media table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        url TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        alt_text TEXT,
        uploaded_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL
    );
    ''')

    # Create Comments table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        author_name TEXT NOT NULL,
        author_email TEXT NOT NULL,
        author_avatar TEXT,
        content TEXT NOT NULL,
        is_approved INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
    );
    ''')

    # Create Sessions table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    ''')

    # Create Post Likes table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS post_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        ip_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (post_id, ip_hash),
        FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
    );
    ''')

    # Create Subscribers table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    ''')

    # Create Contact Messages table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS contact_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    ''')

    conn.commit()

    # Seed data if no users exist
    cursor.execute("SELECT COUNT(*) as count FROM users")
    if cursor.fetchone()['count'] == 0:
        seed_database(conn)

    conn.close()

def seed_database(conn):
    """Seed comprehensive MBBS medical blog posts, study notes, categories, and admin credentials."""
    cursor = conn.cursor()

    # 1. Admin User: anuja2007 / anuskar2020@
    admin_pass = hash_password("anuskar2020@")
    cursor.execute('''
    INSERT INTO users (name, username, email, password_hash, role, avatar, bio, twitter, github, linkedin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        "Dr. Anuja",
        "anuja2007",
        "anuja2007@medo.com",
        admin_pass,
        "admin",
        "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80",
        "MBBS Scholar & Clinical Resident. Founder of Medo. Creating high-yield study frameworks, clinical notes, and ward survival pearls for medical students worldwide.",
        "https://twitter.com",
        "https://github.com",
        "https://linkedin.com"
    ))
    admin_id = cursor.lastrowid

    # Secondary Contributor
    cursor.execute('''
    INSERT INTO users (name, username, email, password_hash, role, avatar, bio, twitter, github, linkedin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        "Dr. Rohan Mehta",
        "rohan_med",
        "rohan@medo.com",
        hash_password("rohan_resident2026"),
        "author",
        "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=400&q=80",
        "Surgery Resident & Med-Ed Mentor. Passionate about emergency trauma protocols, surgical anatomy, and bedside teaching.",
        "https://twitter.com",
        "https://github.com",
        "https://linkedin.com"
    ))
    author_id = cursor.lastrowid

    # 2. Medical Categories
    categories = [
        ("Anatomy & Embryology", "anatomy", "Gross anatomy, neuroanatomy, embryology, histology, and high-yield dissection guides.", "#0284C7", "activity"),
        ("Physiology & Biophysics", "physiology", "Organ systems physiology, hemodynamic loops, respiratory mechanics, and endocrine axes.", "#0D9488", "heart"),
        ("Pharmacology & Therapeutics", "pharmacology", "Mechanisms of action, adverse effects, drug interactions, and clinical prescribing pearls.", "#E11D48", "pill"),
        ("Pathology & Hematology", "pathology", "General pathology mechanisms, systemic pathology, biopsy interpretations, and lab markers.", "#7C3AED", "microscope"),
        ("Internal Medicine & OSCE", "internal-medicine", "Bedside clinical examination, diagnostic workups, emergency protocols, and ward cases.", "#2563EB", "stethoscope"),
        ("General Surgery & Trauma", "surgery", "Surgical principles, acute abdomen, trauma protocols, operative anatomy, and post-op care.", "#EA580C", "scissors"),
        ("Med School Life & Anki", "med-school-life", "Spaced repetition workflows, clinical posting survival, mental resilience, and exam mastery.", "#059669", "book-open")
    ]
    
    cat_ids = {}
    for name, slug, desc, color, icon in categories:
        cursor.execute('INSERT INTO categories (name, slug, description, color, icon) VALUES (?, ?, ?, ?, ?)',
                       (name, slug, desc, color, icon))
        cat_ids[slug] = cursor.lastrowid

    # 3. Medical Tags
    tag_list = [
        ("Anatomy", "anatomy"),
        ("Physiology", "physiology"),
        ("Pharmacology", "pharmacology"),
        ("Pathology", "pathology"),
        ("Medicine", "medicine"),
        ("Surgery", "surgery"),
        ("High-Yield", "high-yield"),
        ("Anki", "anki"),
        ("OSCE", "osce"),
        ("Clinical Pearls", "clinical-pearls"),
        ("NEET-PG", "neet-pg"),
        ("USMLE", "usmle"),
        ("Mnemonics", "mnemonics"),
        ("Cardiology", "cardiology"),
        ("Emergency", "emergency")
    ]

    tag_ids = {}
    for name, slug in tag_list:
        cursor.execute('INSERT INTO tags (name, slug) VALUES (?, ?)', (name, slug))
        tag_ids[slug] = cursor.lastrowid

    # 4. Medical Blog Posts
    posts_data = [
        {
            "title": "Surviving 1st Year MBBS: How to Master Anatomy Dissection, Guyton & Spaced Repetition",
            "slug": "surviving-1st-year-mbbs-anatomy-guyton-study-guide",
            "excerpt": "A battle-tested blueprint for incoming medical students: how to navigate the dissection hall, read voluminous textbooks without drowning, and build long-term retention using Anki.",
            "cover_image": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1400&q=80",
            "author_id": admin_id,
            "category_slug": "med-school-life",
            "status": "published",
            "published_at": "2026-10-20 09:00:00",
            "is_featured": 1,
            "views": 3420,
            "likes_count": 218,
            "read_time": 8,
            "meta_title": "Surviving 1st Year MBBS Guide - Medo",
            "meta_description": "Comprehensive survival guide for first year MBBS students covering Anatomy dissection, Guyton Physiology, and active recall with Anki.",
            "meta_keywords": "mbbs, first year mbbs, anatomy, physiology, guyton, anki, medical school",
            "tags": ["anatomy", "physiology", "anki", "high-yield"],
            "content": """## Welcome to Medical School: The Firehose Analogy

Every senior warns you that medical school is like trying to drink from a firehose. In 1st Year MBBS, you are suddenly confronted with *Gray's Anatomy*, *Guyton & Hall Physiology*, and *Harper's Biochemistry*. Reading these cover-to-cover linearly is an express ticket to burnout.

In this guide, I'll share the system that helped me top our batch while maintaining 7+ hours of sleep and regular exercise.

---

### 1. Anatomy: Dissection Hall Strategy & 3D Visualization

Anatomy is not a test of rote memory; it is a test of **spatial orientation**. 

* **Pre-read Dissection Manuals**: Spend 15 minutes before lab reviewing the boundaries, relations, and neurovascular bundle of the region you are dissecting.
* **Touch and Palpate**: Cadaveric dissection is your only opportunity to feel tissue texture—fascial planes, pulsations of formalin-fixed vessels, and the toughness of tendons.
* **The Clinical Cross-Sections**: University examiners love clinical correlations. For every muscle group, memorize:
  1. Nerve supply with root value (e.g., *Musculocutaneous nerve, C5-C7*)
  2. Arterial supply
  3. Action and deformity on denervation (e.g., *Winged Scapula from Long Thoracic Nerve lesion*)

```markdown
High-Yield Tip:
Draw simplified 2D schematic diagrams with colored pencils! 
Examiners give full marks for labeled line diagrams over paragraphs of text.
```

---

### 2. Physiology: Mastering Concepts Over Passive Reading

Guyton is a masterpiece of storytelling, but students often get lost in 1,100 pages of text.

1. **Focus on Axis & Loops**: Cardiovascular pressure-volume loops, renal countercurrent multiplier, and respiratory compliance curves account for 60% of exam weightage.
2. **Teach It (The Feynman Technique)**: If you cannot explain the cardiac cycle to a non-medical peer without looking at your notes, you have not internalized the physiology.

---

### 3. The Anki Spaced Repetition Workflow

Medical knowledge decays exponentially if left unreviewed. Implement spaced repetition from Day 1:

| Year / Phase | Primary Deck Strategy | Daily Review Target |
| :--- | :--- | :--- |
| **1st Prof** | High-Yield Gross Anatomy & Nerve Roots | 100 - 150 cards/day |
| **2nd Prof** | Sketchy Pharm & Pathoma Histology | 200 - 250 cards/day |
| **Final Prof** | Clinical algorithms & ECG interpretation | 150 - 200 cards/day |

> **Pro-Tip**: Keep your cards concise. One concept per card (Cloze deletions). Avoid making giant paragraph cards that test reading comprehension rather than memory retrieval.

### Final Thoughts

Medical school is an endurance marathon, not a sprint. Take care of your mental well-being, support your batchmates, and remember why you chose this noble profession."""
        },
        {
            "title": "The Systematic Bedside Case Presentation: How to Impress Your Clinical Attendings",
            "slug": "systematic-bedside-case-presentation-clinical-wards",
            "excerpt": "A field guide for 3rd and Final Prof medical students: structured history taking, focused physical exam synthesis, formulating differential diagnoses, and bedside etiquette.",
            "cover_image": "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1400&q=80",
            "author_id": admin_id,
            "category_slug": "internal-medicine",
            "status": "published",
            "published_at": "2026-10-21 11:30:00",
            "is_featured": 1,
            "views": 2890,
            "likes_count": 194,
            "read_time": 7,
            "meta_title": "Bedside Case Presentation Guide - Medo",
            "meta_description": "Learn the gold standard structure for presenting clinical cases during ward rounds and OSCE practical exams.",
            "meta_keywords": "clinical medicine, case presentation, osce, bedside rounds, internal medicine",
            "tags": ["medicine", "osce", "clinical-pearls"],
            "content": """## The Art of the Clinical Presentation

During your clinical postings in Medicine and Surgery, nothing showcases your diagnostic competence more than a crisp, 3-minute bedside case presentation. Professors can tell within the first 60 seconds whether a student has truly examined the patient.

Here is the structured template taught in top university hospitals.

---

### The Universal 60-Second Opening Sentence

Never begin with "The patient is a 45-year-old male who came with fever." Instead, synthesize the patient's demographic, risk profile, and primary symptom duration into a unified headline:

> *"Mr. Sharma is a 54-year-old known diabetic and hypertensive male who presents with a 3-day history of acute crushing substernal chest pain radiating to his left jaw, accompanied by diaphoresis and exertional dyspnea (NYHA Class III)."*

This immediately communicates:
1. Patient risk factors (Diabetes, HTN)
2. Symptom character, location, radiation
3. Functional impairment (NYHA class)

---

### Structuring History of Present Illness (HPI) using SOCRATES

For any presenting pain, systematically present:

* **S**ite (Substernal)
* **O**nset (Sudden onset while walking)
* **C**haracter (Constricting / crushing)
* **R**adiation (Left arm, jaw, epigastrium)
* **A**ssociated symptoms (Nausea, sweating, presyncope)
* **T**iming & duration (Episodic vs continuous)
* **E**xacerbating / Relieving factors (Relieved partially with rest)
* **S**everity (8/10 on visual analogue scale)

---

### General Physical Examination (GPE) Checklist

Do not recite normal findings haphazardly. Follow the **P-I-C-C-L-E** mnemonic:

1. **P**allor: Lower palpebral conjunctiva, dorsum of tongue, nailbeds
2. **I**cterus: Superior bulbar sclera under natural sunlight
3. **C**yanosis: Central (tongue, lips) vs. Peripheral (fingertips, toe pads)
4. **C**lubbing: Lovibond's angle obliteration, Schamroth's sign
5. **L**ymphadenopathy: Cervical, axillary, epitrochlear, inguinal
6. **E**dema: Bilateral pitting pedal edema over medial malleolus

---

### Presenting Your Summary & Problem List

Conclude your presentation with a concise summary followed by a ranked differential diagnosis:

1. **Most Likely Diagnosis** with supporting positive findings.
2. **Must-Not-Miss Emergencies** (e.g., Acute Coronary Syndrome, Aortic Dissection, Pulmonary Embolism).
3. **Targeted Investigations** categorized into Bedside (ECG, Troponin I), Laboratory (CBC, Renal profile), and Imaging (Echocardiogram, CT Angiography)."""
        },
        {
            "title": "Building Your Medical Second Brain: How I Use Anki & Spaced Repetition",
            "slug": "building-medical-second-brain-anki-spaced-repetition",
            "excerpt": "The exact spaced repetition setup, card formulation principles, and daily review routines that took me from overwhelmed to the top 5% of my medical batch.",
            "cover_image": "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1400&q=80",
            "author_id": admin_id,
            "category_slug": "med-school-life",
            "status": "published",
            "published_at": "2026-10-22 14:15:00",
            "is_featured": 0,
            "views": 2150,
            "likes_count": 167,
            "read_time": 6,
            "meta_title": "Building Your Medical Second Brain - Medo",
            "meta_description": "Master Anki and spaced repetition for medical school exams, USMLE, and NEET-PG.",
            "meta_keywords": "anki, spaced repetition, medical student, neet pg, usmle",
            "tags": ["anki", "high-yield", "usmle", "neet-pg"],
            "content": """## Why 90% of Medical Students Use Anki Wrong

Anki is the most powerful cognitive amplifier available to modern medical students. However, many students download massive 30,000-card pre-made decks, get buried under 800 daily review queues within two weeks, and quit out of frustration.

Here is how to set up an intentional, sustainable spaced repetition engine.

---

### The Cardinal Rules of Card Formulation

1. **Understand First, Memorize Second**: Never make or review a card for a concept you do not understand. If you don't understand the Frank-Starling law, memorizing a card on end-diastolic volume is useless.
2. **The Minimum Information Principle**: Each flashcard should test exactly **one** discrete atom of knowledge.
   
```text
Bad Card:
Q: Describe Myasthenia Gravis pathophysiology, antibodies, and treatments.
A: [Giant block of 8 lines]

Good Card (Cloze):
Myasthenia Gravis is caused by autoantibodies against {{c1::nicotinic acetylcholine}} receptors at the {{c2::postsynaptic}} neuromuscular junction.
```

---

### Daily Routine & Queue Management

* **Morning Reviews First**: Complete all due reviews before opening new lectures. This prevents backlog debt.
* **Cap New Cards**: Add no more than 30–50 new cards per day. Remember: every new card multiplies into ~7 reviews over the coming month.
* **FSRS Algorithm**: Switch to the Free Spaced Repetition Scheduler (FSRS) in Anki 23.10+ for 25% better retention efficiency over legacy SM-2."""
        },
        {
            "title": "High-Yield Pharmacology Mnemonics & Receptor Maps for University Profs and NEET-PG",
            "slug": "high-yield-pharmacology-mnemonics-receptor-maps",
            "excerpt": "Stop confusing autonomic receptors and antimicrobial mechanisms. Here are the battle-tested visual mnemonics and receptor maps every medical student needs.",
            "cover_image": "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=1400&q=80",
            "author_id": admin_id,
            "category_slug": "pharmacology",
            "status": "published",
            "published_at": "2026-10-23 16:45:00",
            "is_featured": 0,
            "views": 3110,
            "likes_count": 240,
            "read_time": 7,
            "meta_title": "High Yield Pharmacology Mnemonics - Medo",
            "meta_description": "Essential pharmacology mnemonics, autonomic receptor maps, and antibiotic mechanisms for medical students.",
            "meta_keywords": "pharmacology, mnemonics, autonomic nervous system, antibiotics, medical school",
            "tags": ["pharmacology", "mnemonics", "high-yield"],
            "content": """## Conquering 2nd Prof Pharmacology

Pharmacology is notorious for having hundreds of drug names that sound like fantasy wizards. Without structured associative mnemonics, recalling adverse effect profiles under exam stress is nearly impossible.

Let's break down the highest-yield receptor maps and mnemonics.

---

### 1. Autonomic Nervous System: The G-Protein Receptor Rule

Memorize the G-protein couplings using the classic **Q-I-S-S-Q** and **Q-I-Q** formulas:

* **Alpha-1**: $G_q$ (Phospholipase C $\\rightarrow$ $IP_3$ / DAG $\\rightarrow$ Calcium influx $\\rightarrow$ Vasoconstriction)
* **Alpha-2**: $G_i$ (Inhibitory $\\rightarrow$ Decreased cAMP $\\rightarrow$ Decreased sympathetic outflow)
* **Beta-1**: $G_s$ (Stimulatory $\\rightarrow$ Increased cAMP in Heart $\\rightarrow$ Positive inotropy & chronotropy)
* **Beta-2**: $G_s$ (Stimulatory $\\rightarrow$ Increased cAMP in smooth muscle $\\rightarrow$ Bronchodilation & vasodilation)
* **Beta-3**: $G_s$ (Lipolysis, detrusor relaxation)

For Cholinergic Muscarinic Receptors:
* **M1, M3, M5**: $G_q$ (HAVe 1 M&M: $H_1, \\alpha_1, V_1, M_1, M_3, M_5$)
* **M2, M4**: $G_i$ (M2 in the heart $\\rightarrow$ Bradycardia)

---

### 2. Protein Synthesis Inhibiting Antibiotics: 30S vs 50S

Use the immortal mnemonic: **"Buy AT 30, CCEL at 50"**

#### 30S Subunit Inhibitors:
* **A**: Aminoglycosides (Gentamicin, Amikacin) — *Bactericidal!*
* **T**: Tetracyclines (Doxycycline) — *Bacteriostatic*

#### 50S Subunit Inhibitors:
* **C**: Chloramphenicol (Gray Baby Syndrome, Aplastic Anemia)
* **C**: Clindamycin (Pseudomembranous colitis risk via C. diff)
* **E**: Erythromycin (Macrolides: Azithromycin, Clarithromycin)
* **L**: Linezolid (Serotonin syndrome with SSRIs, bone marrow suppression)"""
        },
        {
            "title": "Night Shifts on Emergency & Trauma Call: Practical Lessons Textbooks Never Teach You",
            "slug": "night-shifts-emergency-trauma-clinical-experience",
            "excerpt": "Reflections from a 24-hour casualty rotation: prioritizing ABCDE in polytrauma, managing adrenaline, communicating with grieving families, and clinical triage.",
            "cover_image": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1400&q=80",
            "author_id": author_id,
            "category_slug": "surgery",
            "status": "published",
            "published_at": "2026-10-24 18:20:00",
            "is_featured": 0,
            "views": 1950,
            "likes_count": 158,
            "read_time": 6,
            "meta_title": "Night Shifts on Emergency & Trauma - Medo",
            "meta_description": "First-hand reflections and clinical lessons from working overnight casualty shifts in a busy trauma hospital.",
            "meta_keywords": "emergency medicine, trauma, surgery, casualty rotation, doctor life",
            "tags": ["surgery", "emergency", "clinical-pearls"],
            "content": """## The 2:00 AM Siren

The first time the casualty red phone rings at 2 AM with a Code Trauma inbound, your resting heart rate doubles. No MCQ question bank can simulate the sensory overload of screaming ambulances, monitor alarms, and triage chaos.

Here are the non-negotiable mental algorithms you need when stepping into the emergency department.

---

### 1. ABCDE Is Not an Exam Answer; It Is an Absolute Shield

Under extreme adrenaline, human beings develop tunnel vision. You see a visibly deformed open compound femur fracture with active bleeding, and your instinct is to fixate on the leg. 

**Stop.** If the patient does not have a patent airway, they will die in 3 minutes while you are splinting their leg.

1. **A - Airway with cervical spine immobilization**: Talk to the patient. If they answer clearly, airway is patent. If gurgling or unconscious, prepare jaw thrust and suction.
2. **B - Breathing & Ventilation**: Look for bilateral chest rise, listen for tension pneumothorax (tracheal deviation, absent breath sounds $\\rightarrow$ immediate needle decompression).
3. **C - Circulation with Hemorrhage Control**: Two large-bore 16G/18G IV cannulae in antecubital fossae, initiate warm crystalloids, draw blood for cross-match.
4. **D - Disability**: GCS score and pupillary light reflex.
5. **E - Exposure & Environmental Control**: Undress completely to inspect back, axillae, and perineum; keep patient warm to prevent hypothermia."""
        }
    ]

    for p in posts_data:
        cat_id = cat_ids.get(p["category_slug"])
        cursor.execute('''
        INSERT INTO posts (
            title, slug, excerpt, content, cover_image, author_id, category_id,
            status, scheduled_at, published_at, is_featured, views, likes_count,
            read_time, meta_title, meta_description, meta_keywords
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            p["title"],
            p["slug"],
            p["excerpt"],
            p["content"],
            p["cover_image"],
            p["author_id"],
            cat_id,
            p["status"],
            None,
            p["published_at"],
            p["is_featured"],
            p["views"],
            p["likes_count"],
            p["read_time"],
            p["meta_title"],
            p["meta_description"],
            p["meta_keywords"]
        ))
        post_id = cursor.lastrowid

        for t_slug in p["tags"]:
            t_id = tag_ids.get(t_slug)
            if t_id:
                cursor.execute('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)', (post_id, t_id))

    # 5. Seed Comprehensive MBBS Study Notes
    notes_data = [
        {
            "title": "Brachial Plexus Decoded: Roots, Cords, Branches & Clinical Palsies (Erb's vs. Klumpke's)",
            "slug": "brachial-plexus-roots-cords-branches-clinical-palsies",
            "subject": "Anatomy",
            "prof_year": "1st Prof",
            "topic": "Upper Limb & Neuroanatomy",
            "summary": "Complete structural breakdown of the Brachial Plexus (C5-T1). Roots, trunks, divisions, cords, and terminal nerves. Erb-Duchenne palsy (waiter's tip hand) vs. Klumpke's palsy (claw hand), Horner's syndrome connection, and high-yield clinical MCQs.",
            "content": """## Anatomical Overview: The C5-T1 Highway

The Brachial Plexus provides motor and sensory innervation to the entire upper extremity. It originates from the **anterior primary rami of C5, C6, C7, C8, and T1**.

```
Roots (5) ──▶ Trunks (3) ──▶ Divisions (6) ──▶ Cords (3) ──▶ Terminal Branches (5)
(Remember: "Remember To Drink Cold Beer")
```

---

### Step-by-Step Architecture

1. **Roots**:
   - Anterior rami of C5, C6, C7, C8, T1
   - Direct branches: Long Thoracic Nerve (C5, C6, C7 to Serratus Anterior) & Dorsal Scapular Nerve (C5 to Rhomboids).
2. **Trunks** (in Posterior Triangle of Neck):
   - **Upper Trunk**: C5 + C6
   - **Middle Trunk**: C7
   - **Lower Trunk**: C8 + T1
   - Suprascapular Nerve & Nerve to Subclavius branch off Upper Trunk (Erb's Point).
3. **Divisions** (Behind Clavicle):
   - Each trunk divides into Anterior and Posterior divisions (3 anterior + 3 posterior = 6 divisions).
   - Posterior divisions supply extensor compartments; Anterior supply flexor compartments.
4. **Cords** (Arranged around 2nd part of Axillary Artery):
   - **Lateral Cord**: Anterior divisions of Upper & Middle trunks (C5, C6, C7).
   - **Medial Cord**: Anterior division of Lower trunk (C8, T1).
   - **Posterior Cord**: All 3 Posterior divisions (C5, C6, C7, C8, T1).

---

### Terminal Nerves & Motor Supplies

| Cord | Terminal Branches | High-Yield Muscle Innervations |
| :--- | :--- | :--- |
| **Lateral Cord** | Musculocutaneous Nerve | Biceps Brachii, Brachialis, Coracobrachialis |
| **Medial Cord** | Ulnar Nerve | FCU, Medial half of FDP, all intrinsic hand muscles (except 1LOAF) |
| **Both Cords** | Median Nerve | Anterior forearm flexors, Thenar muscles, Lumbricals 1 & 2 |
| **Posterior Cord**| Radial Nerve, Axillary Nerve | Triceps, Brachioradialis, Wrist extensors, Deltoid, Teres minor |

---

### High-Yield Clinical Lesions

#### 1. Erb-Duchenne Palsy (Upper Trunk Lesion: C5, C6)
* **Mechanism**: Excessive increase in angle between head and shoulder (difficult breech delivery, motorcycle fall landing on shoulder).
* **Nerves Affected**: Suprascapular, Musculocutaneous, Axillary.
* **Deformity**: **"Waiter's Tip" / "Porter's Hand"**
  - Arm is **Adducted** (loss of Deltoid/Supraspinatus)
  - Medially **Rotated** (loss of Infraspinatus/Teres minor)
  - Forearm **Extended** (loss of Biceps)
  - Forearm **Pronated** (loss of Biceps supination)

#### 2. Klumpke Palsy (Lower Trunk Lesion: C8, T1)
* **Mechanism**: Upward traction on arm (catching a tree branch while falling, breech delivery pulling by arm).
* **Nerves Affected**: Ulnar and Median nerves (C8, T1 roots).
* **Deformity**: **Total Claw Hand** (loss of all lumbricals and interossei causing MCP extension and IP flexion).
* **Associated Finding**: **Horner's Syndrome** (Ptosis, Miosis, Anhidrosis, Enophthalmos) due to damage to sympathetic fibers in T1 root!""",
            "download_url": "https://drive.google.com/uc?export=download&id=medo-brachial-plexus-anatomy",
            "is_high_yield": 1,
            "read_time": 6,
            "views": 4120,
            "downloads_count": 860
        },
        {
            "title": "Cardiovascular Physiology: Wiggers Diagram, Pressure-Volume Loops & Heart Murmurs",
            "slug": "cardiovascular-physiology-wiggers-diagram-pv-loops-murmurs",
            "subject": "Physiology",
            "prof_year": "1st Prof",
            "topic": "Cardiovascular System",
            "summary": "Step-by-step masterclass on the cardiac cycle: Wiggers diagram correlated with ECG, heart sounds S1-S4, jugular venous pulse (a, c, v waves), left ventricular pressure-volume loops, and dynamic auscultation of systolic vs. diastolic murmurs.",
            "content": """## The Cardiac Cycle: Chronological Phases

The cardiac cycle represents the mechanical, electrical, and hemodynamic events occurring during a single heartbeat. 

---

### The 7 Key Phases (Systole & Diastole)

1. **Atrial Systole**: Corresponds to 'a' wave of JVP. Supplies final 20–30% of ventricular filling (atrial kick).
2. **Isovolumetric Contraction**:
   - Ventricular pressure rises sharply above atrial pressure $\\rightarrow$ **Mitral & Tricuspid valves SNAP shut (S1 Heart Sound)**.
   - All valves closed; ventricular volume remains constant.
3. **Rapid Ventricular Ejection**: LV pressure exceeds aortic diastolic pressure (~80 mmHg) $\\rightarrow$ Aortic valve opens.
4. **Reduced Ventricular Ejection**: T wave on ECG begins (ventricular repolarization).
5. **Isovolumetric Relaxation**:
   - Ventricular pressure drops below aortic pressure $\\rightarrow$ **Aortic & Pulmonic valves SNAP shut (S2 Heart Sound)**.
   - All valves closed; no change in ventricular volume.
6. **Rapid Ventricular Filling**: AV valves open; blood rushes into ventricles (**S3 may be heard in young adults or heart failure**).
7. **Reduced Filling (Diastasis)**: Passive venous return.

---

### PV Loop Shift Matrix

Understanding how preload, afterload, and contractility shift the Pressure-Volume loop is tested constantly in university exams:

| Intervention | End-Diastolic Volume (EDV) | End-Systolic Volume (ESV) | Stroke Volume (SV) | Width of Loop |
| :--- | :--- | :--- | :--- | :--- |
| **$\\uparrow$ Preload** (IV Fluids) | Increases | No change | Increases | Widens to the right |
| **$\\uparrow$ Afterload** (Hypertension, AS) | No change or slight $\\uparrow$ | Increases | Decreases | Taller & narrower |
| **$\\uparrow$ Inotropy** (Dobutamine, Exercise)| No change | Decreases | Increases | Widens to the left |

---

### Heart Sounds & Auscultation Pearls

* **S1 ("LUB")**: Closure of Mitral (M1) and Tricuspid (T1). Best heard at apex.
* **S2 ("DUB")**: Closure of Aortic (A2) and Pulmonic (P2). Splitting increases on inspiration.
* **S3 ("Kentucky")**: Rapid ventricular filling into a non-compliant, dilated ventricle (Systolic Heart Failure, Dilated Cardiomyopathy).
* **S4 ("Tennessee")**: Atrial kick against a stiff, hypertrophied ventricle (Diastolic Heart Failure, Chronic HTN). Always pathological!""",
            "download_url": "https://drive.google.com/uc?export=download&id=medo-cardiac-cycle-physiology",
            "is_high_yield": 1,
            "read_time": 7,
            "views": 3810,
            "downloads_count": 740
        },
        {
            "title": "Anti-Hypertensive Pharmacology: Drug Classes, Mechanisms, Indications & Contraindications",
            "slug": "anti-hypertensive-pharmacology-drug-classes-indications",
            "subject": "Pharmacology",
            "prof_year": "2nd Prof",
            "topic": "Cardiovascular Therapeutics",
            "summary": "First-line anti-hypertensive drugs (ACE inhibitors, ARBs, CCBs, Thiazides). Mechanism of actions, receptor interactions, compelling clinical indications (Diabetes, CKD, Post-MI, Heart Failure, Pregnancy), high-yield adverse reactions, and hypertensive emergency management.",
            "content": """## First-Line Anti-Hypertensive Arsenal

According to AHA/ACC and ESC guidelines, the four foundational pillars of hypertension treatment are:

1. **ACE Inhibitors (ACEi)**: Enalapril, Lisinopril, Ramipril
2. **Angiotensin Receptor Blockers (ARBs)**: Losartan, Telmisartan, Valsartan
3. **Calcium Channel Blockers (CCBs)**: Dihydropyridines (Amlodipine) & Non-DHP (Diltiazem, Verapamil)
4. **Thiazide-like Diuretics**: Chlorthalidone, Indapamide, Hydrochlorothiazide

---

### Compelling Clinical Indications (The Match Game)

| Patient Profile | Preferred First-Line Agent | Clinical Rationale |
| :--- | :--- | :--- |
| **Type 2 Diabetes Mellitus** | ACEi or ARB | Renoprotective: dilates efferent arteriole, reduces intraglomerular pressure & proteinuria |
| **Chronic Kidney Disease (CKD)** | ACEi or ARB | Slows progression of diabetic and non-diabetic nephropathy |
| **Post-Myocardial Infarction** | Beta-blocker + ACEi | Decreases myocardial $O_2$ demand, prevents cardiac remodeling |
| **Heart Failure (HFrEF)** | ARNI/ACEi + Beta-Blocker + MRA + SGLT2i | The "Fantastic Four" proven mortality reduction |
| **Hypertension in Pregnancy** | **Labetalol**, **Nifedipine**, **Methyldopa** ("Little New Mothers") | ACEi/ARBs are strictly contraindicated (teratogenic)! |
| **Benign Prostatic Hyperplasia** | Prazosin, Doxazosin ($\\alpha_1$-blockers) | Relaxes prostatic smooth muscle while lowering BP |

---

### High-Yield Adverse Drug Reactions

* **ACE Inhibitors**:
  - **Dry Cough & Angioedema**: Caused by bradykinin accumulation (inactivated by ACE). If cough occurs, switch to ARB!
  - **Hyperkalemia**: Due to reduced aldosterone secretion.
* **Calcium Channel Blockers (Amlodipine)**:
  - **Bilateral Ankle Edema**: Caused by precapillary arteriolar dilation (not fluid retention).
* **Thiazide Diuretics**:
  - **HyperGLUC**: Hyper**G**lycemia, Hyper**L**ipidemia, Hyper**U**ricemia (precipitates Gout!), Hyper**C**alcemia.
  - **Hypokalemia & Hyponatremia**.""",
            "download_url": "https://drive.google.com/uc?export=download&id=medo-antihypertensives-pharm",
            "is_high_yield": 1,
            "read_time": 6,
            "views": 4920,
            "downloads_count": 1050
        },
        {
            "title": "Glomerulonephritis Masterclass: Nephrotic vs. Nephritic Syndromes & Biopsy Histology",
            "slug": "glomerulonephritis-nephrotic-vs-nephritic-histology-biopsy",
            "subject": "Pathology",
            "prof_year": "2nd Prof",
            "topic": "Renal Pathology",
            "summary": "Diagnostic roadmap separating Nephrotic Syndrome (>3.5g/day proteinuria, edema, hypoalbuminemia, hyperlipidemia) from Nephritic Syndrome (hematuria, RBC casts, hypertension, oliguria). Light microscopy, immunofluorescence, and electron microscopy findings for MCD, FSGS, MGN, PSGN, and RPGN.",
            "content": """## The Glomerular Spectrum: Nephrotic vs. Nephritic

Glomerular pathology is best approached by dividing clinical syndromes into two archetypes based on proteinuria severity and inflammatory destruction.

```
Nephrotic Syndrome: Podocyte effacement ──▶ Heavy Proteinuria (>3.5g/24h) ──▶ Edema & Hypoalbuminemia
Nephritic Syndrome: Glomerular inflammation ──▶ Hematuria + RBC Casts ──▶ Oliguria & Hypertension
```

---

### Nephrotic Syndrome Differential

| Disease | Typical Patient | Light Microscopy (LM) | Immunofluorescence (IF) | Electron Microscopy (EM) |
| :--- | :--- | :--- | :--- | :--- |
| **Minimal Change Disease (MCD)** | Children (2–6 yrs) | Normal glomeruli | Negative | **Effacement of podocyte foot processes** |
| **Focal Segmental (FSGS)** | HIV, Heroin, African descent | Segmental sclerosis & hyalinosis | Negative or nonspecific IgM/C3 | Foot process effacement |
| **Membranous Nephropathy (MGN)**| Adults, Anti-PLA2R, Hep B/C | Uniform diffuse GBM thickening | Granular IgG and C3 | **"Spike and Dome"** subepithelial deposits |
| **Diabetic Nephropathy** | Long-standing diabetes | Mesangial expansion, GBM thickening | Negative | **Kimmelstiel-Wilson nodules** |

---

### Nephritic Syndrome Differential

1. **Post-Streptococcal Glomerulonephritis (PSGN)**:
   - 2–4 weeks after group A strep pharyngitis or impetigo.
   - **LM**: Hypercellular, enlarged glomeruli packed with neutrophils.
   - **IF**: "Starry Sky" granular pattern (IgG, C3).
   - **EM**: **Subepithelial "Humps"**. Low serum C3 levels.
2. **IgA Nephropathy (Berger's Disease)**:
   - Young adult presenting with episodic gross hematuria 1–2 days after URI (**Synpharyngitic**).
   - **IF**: Mesangial IgA deposition. Normal serum complement.
3. **Rapidly Progressive Glomerulonephritis (RPGN)**:
   - Acute renal failure over weeks to months.
   - **LM**: **Crescent formation** consisting of fibrin and proliferating parietal epithelial cells.""",
            "download_url": "https://drive.google.com/uc?export=download&id=medo-glomerulonephritis-pathology",
            "is_high_yield": 1,
            "read_time": 7,
            "views": 3650,
            "downloads_count": 810
        },
        {
            "title": "Systemic Antibiotics Guide: Class Mechanisms, Spectrum, Resistance & Side Effects",
            "slug": "systemic-antibiotics-class-mechanisms-spectrum-side-effects",
            "subject": "Microbiology",
            "prof_year": "2nd Prof",
            "topic": "Antimicrobial Chemotherapy",
            "summary": "Essential guide to bactericidal vs bacteriostatic antimicrobials. Beta-lactams, Glycopeptides (Vancomycin), Aminoglycosides, Macrolides, Fluoroquinolones, and Folate antagonists. First-line empiric coverage for Sepsis, Community-Acquired Pneumonia, Bacterial Meningitis, and Pyelonephritis.",
            "content": """## Classification by Mechanism of Action

### 1. Bacterial Cell Wall Synthesis Inhibitors

* **Penicillins & Cephalosporins ($\\beta$-lactams)**: Bind Penicillin-Binding Proteins (PBPs) $\\rightarrow$ block transpeptidation cross-linking of peptidoglycan layer.
* **Vancomycin (Glycopeptide)**: Binds directly to the D-Ala-D-Ala terminus of cell wall peptidoglycan precursors.
  - *Clinical Use*: Severe MRSA, Enterococcal infections, oral for *C. difficile* colitis.
  - *Adverse Effects*: Red Man Syndrome (infusion-related histamine release; preventable by slow infusion), Ototoxicity, Nephrotoxicity.

---

### 2. Bacterial Protein Synthesis Inhibitors

* **Aminoglycosides (Gentamicin, Amikacin)**: Irreversibly bind 30S ribosomal subunit. Bactericidal. Require oxygen for uptake (ineffective against anaerobes!).
* **Tetracyclines (Doxycycline)**: Reversibly bind 30S subunit. Bacteriostatic. Drug of choice for Atypical pneumonia (*Mycoplasma*), Lyme disease, Chlamydia, Rickettsia. Contraindicated in children <8 years and pregnancy due to tooth enamel hypoplasia.
* **Macrolides (Azithromycin)**: Reversibly bind 50S subunit. Inhibits CYP3A4, QT interval prolongation risk.

---

### 3. DNA & RNA Synthesis Inhibitors

* **Fluoroquinolones (Ciprofloxacin, Levofloxacin)**: Inhibit DNA gyrase (topoisomerase II) and topoisomerase IV.
  - *Adverse Effects*: Tendonitis / Achilles tendon rupture (black box warning), QT prolongation, aortic aneurysm exacerbation.
* **Metronidazole**: Generates toxic free radicals that disrupt anaerobic DNA. Drug of choice for *Giardia*, *Entamoeba*, *Trichomonas*, and intra-abdominal anaerobes (*Bacteroides*). Disulfiram-like reaction with alcohol!""",
            "download_url": "https://drive.google.com/uc?export=download&id=medo-antibiotics-microbiology",
            "is_high_yield": 1,
            "read_time": 6,
            "views": 2980,
            "downloads_count": 690
        },
        {
            "title": "Systematic 12-Lead ECG Interpretation Algorithm: Axis, Arrhythmias & STEMI Localization",
            "slug": "systematic-12-lead-ecg-interpretation-algorithm-stemi",
            "subject": "Internal Medicine",
            "prof_year": "Final Prof",
            "topic": "Clinical Cardiology",
            "summary": "Mastering the 6-step ECG algorithm: Rate, Rhythm, Electrical Axis, Intervals (PR, QRS, QTc), Hypertrophy criteria, and Ischemia/Infarction localization (Anterior, Inferior, Lateral, Posterior STEMI) with reciprocal changes and culprit coronary arteries.",
            "content": """## The 6-Step Systematic ECG Algorithm

Never jump straight to ST-segment elevation. Analyze every 12-lead ECG using this disciplined sequence:

1. **Calibration & Rate**:
   - Standard paper speed: 25 mm/sec (1 small box = 0.04s, 1 large box = 0.2s).
   - Rate calculation: $300 / (\\text{Number of large boxes between R-R})$ or count R waves in 30 large boxes (6 seconds) $\\times 10$.
2. **Rhythm**:
   - Are P waves present and followed by QRS? Are P waves upright in Lead II? (Sinus rhythm).
   - Regular vs. Irregularly Irregular (Atrial Fibrillation).
3. **Cardiac Axis**:
   - Look at Lead I and aVF:
     - **Normal Axis**: Lead I (+), aVF (+)
     - **Left Axis Deviation (LAD)**: Lead I (+), aVF (-) [Leaves pointing away: "Leaving each other"]
     - **Right Axis Deviation (RAD)**: Lead I (-), aVF (+) [Pointing toward each other: "Returning to each other"]
4. **Intervals**:
   - **PR Interval**: 0.12–0.20s (3–5 small boxes). Prolonged = 1st Degree AV Block.
   - **QRS Duration**: <0.12s (<3 small boxes). Widened (>0.12s) = Bundle Branch Block (LBBB/RBBB) or Ventricular rhythm.
   - **QTc Interval**: <440ms in men, <460ms in women. Prolonged = risk of Torsades de Pointes.
5. **Hypertrophy**:
   - **LVH (Sokolow-Lyon)**: $S \\text{ in } V_1 + R \\text{ in } V_5/V_6 > 35\\text{ mm}$.
6. **ST-T Changes & STEMI Localization**:

---

### STEMI Anatomical Matrix

| Infarction Territory | Leads with ST Elevation | Reciprocal Leads (ST Depression) | Culprit Coronary Artery |
| :--- | :--- | :--- | :--- |
| **Anterior / Septal** | $V_1, V_2, V_3, V_4$ | II, III, aVF | **LAD** (Left Anterior Descending) |
| **Inferior** | II, III, aVF | I, aVL | **RCA** (Right Coronary Artery) in 85% |
| **Lateral** | I, aVL, $V_5, V_6$ | II, III, aVF | **LCx** (Left Circumflex Artery) |
| **Posterior** | $V_7, V_8, V_9$ (or tall R in $V_1$-$V_2$) | Horizontal ST depression in $V_1$-$V_3$ | RCA or LCx |
| **Right Ventricular** | $V_3R, V_4R$ (caution with nitrates!) | — | Proximal RCA |""",
            "download_url": "https://drive.google.com/uc?export=download&id=medo-12-lead-ecg-medicine",
            "is_high_yield": 1,
            "read_time": 8,
            "views": 5320,
            "downloads_count": 1280
        },
        {
            "title": "The Acute Abdomen: Differential Diagnosis, Physical Signs & Surgical Decision Matrix",
            "slug": "acute-abdomen-differential-diagnosis-surgical-signs",
            "subject": "General Surgery",
            "prof_year": "Final Prof",
            "topic": "Emergency General Surgery",
            "summary": "Urgent evaluation of severe nontraumatic abdominal pain: peritonitis signs (guarding, rigidity, rebound tenderness), quadrant-based differentials, McBurney's, Murphy's, Rovsing's, and Grey Turner's signs, and knowing when to rush to the OR.",
            "content": """## What Defines a Surgical Acute Abdomen?

An 'acute abdomen' is a clinical syndrome characterized by sudden-onset, non-traumatic, severe abdominal pain typically of less than 24 hours duration that may require urgent surgical intervention.

---

### Cardinal Peritoneal Signs: True vs False

* **Involuntary Guarding**: Reflex spasm of abdominal wall musculature on palpation. Does not relax when patient is asked to breathe out or bend their knees.
* **Board-like Rigidity**: Universal continuous spasm across the entire anterior abdominal wall. Indicative of diffuse peritonitis (e.g., perforated peptic ulcer).
* **Rebound Tenderness (Blumberg Sign)**: Pain is sharper when the examining hand is rapidly withdrawn than when pressure is applied. Indicates parietal peritoneal irritation.

---

### Eponymous Signs Every Medical Student Must Elicit

1. **McBurney's Point Tenderness**: Maximum tenderness 1/3 the distance from the anterior superior iliac spine (ASIS) to the umbilicus. Highly indicative of **Acute Appendicitis**.
2. **Rovsing's Sign**: Continuous deep palpation in the Left Lower Quadrant produces referred pain in the Right Lower Quadrant.
3. **Psoas Sign**: Pain elicited on passive extension of the right hip with patient lying on left side. Indicates retrocecal appendicitis.
4. **Murphy's Sign**: Patient suddenly arrests inspiration due to sharp pain when the examiner palpatates beneath the right costal margin during deep breathing. Hallmarked in **Acute Cholecystitis**.
5. **Cullen's & Grey Turner's Signs**: Blue-purple ecchymosis around the umbilicus (Cullen's) or flanks (Grey Turner's). Indicates retroperitoneal hemorrhage / severe acute necrotizing pancreatitis.""",
            "download_url": "https://drive.google.com/uc?export=download&id=medo-acute-abdomen-surgery",
            "is_high_yield": 1,
            "read_time": 7,
            "views": 3410,
            "downloads_count": 790
        }
    ]

    for n in notes_data:
        cursor.execute('''
        INSERT INTO notes (
            title, slug, subject, prof_year, topic, summary, content,
            download_url, is_high_yield, read_time, views, downloads_count,
            status, author_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ''', (
            n["title"],
            n["slug"],
            n["subject"],
            n["prof_year"],
            n["topic"],
            n["summary"],
            n["content"],
            n["download_url"],
            n["is_high_yield"],
            n["read_time"],
            n["views"],
            n["downloads_count"],
            admin_id
        ))

    # 6. Sample Medical Student Comments
    sample_comments = [
        (1, "Dr. Priya Nair", "priya.nair@medstudent.org", "https://images.unsplash.com/photo-1594824813629-d58e3810488f?auto=format&fit=crop&w=200&q=80", "The advice on prioritizing spatial cross-sections over text memorization transformed how I approach anatomy practicals. Thank you Dr. Anuja!", 1),
        (1, "Kabir Sharma", "kabir.mbbs@example.com", "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80", "The Anki FSRS tips are golden. I was doing 800 cards a day and burning out; capping new cards at 40 saved my sanity.", 1),
        (2, "Sneha Sen", "sneha.clinics@example.com", "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80", "Used the unified 60-second opening sentence today in medicine rounds. My attending actually nodded and smiled for the first time!", 1),
        (4, "Dr. Aris Thorne", "aris.thorne@hospital.edu", "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80", "The QISSQ mnemonic for autonomic G-proteins is by far the cleanest explanation I have seen. Sharing this with our junior batch.", 1)
    ]

    for pid, name, email, avatar, content, is_app in sample_comments:
        cursor.execute('''
        INSERT INTO comments (post_id, author_name, author_email, author_avatar, content, is_approved)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (pid, name, email, avatar, content, is_app))

    # 7. Sample Media Uploads
    sample_media = [
        ("stethoscope-pearls.jpg", "stethoscope-pearls.jpg", "uploads/sample-1.jpg", "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1400&q=80", 245000, "image/jpeg", "Stethoscope and medical clinical notes", admin_id),
        ("doctor-rounds.jpg", "doctor-rounds.jpg", "uploads/sample-2.jpg", "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1400&q=80", 182000, "image/jpeg", "Clinical bedside rounds in hospital ward", admin_id),
        ("pharmacology-drugs.jpg", "pharmacology-drugs.jpg", "uploads/sample-3.jpg", "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=1400&q=80", 210000, "image/jpeg", "Pharmacology capsules and therapeutics", admin_id),
        ("hospital-trauma.jpg", "hospital-trauma.jpg", "uploads/sample-4.jpg", "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1400&q=80", 195000, "image/jpeg", "Emergency department trauma hall", author_id)
    ]

    for fn, orig, fp, url, sz, mime, alt, uid in sample_media:
        cursor.execute('''
        INSERT INTO media (filename, original_name, file_path, url, file_size, mime_type, alt_text, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (fn, orig, fp, url, sz, mime, alt, uid))

    conn.commit()

if __name__ == '__main__':
    init_db()
    print("Medo MBBS database initialized and seeded successfully!")
