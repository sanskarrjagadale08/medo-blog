/**
 * Medo — The MBBS Student Public Frontend Application
 * Handles routing, views, study notes panel, clinical articles, search modal, and interactions.
 */

const App = {
  state: {
    currentRoute: '/',
    routeParams: {},
    currentPage: 1,
    postsPerPage: 6,
    currentCategory: '',
    currentTag: '',
    searchQuery: '',
    // Notes state
    notesPage: 1,
    notesPerPage: 12,
    notesSubject: '',
    notesProfYear: '',
    notesSearch: '',
    notesHighYieldOnly: false,
    darkMode: localStorage.getItem('medo_theme') === 'dark' || localStorage.getItem('mdei_theme') === 'dark',
    likedPosts: JSON.parse(localStorage.getItem('medo_liked_posts') || localStorage.getItem('mdei_liked_posts') || '[]'),
    bookmarkedPosts: JSON.parse(localStorage.getItem('medo_bookmarks') || localStorage.getItem('mdei_bookmarks') || '[]'),
  },

  init() {
    this.initTheme();
    this.initRouter();
    this.initGlobalListeners();
    this.checkAdminStatus();
  },

  initTheme() {
    if (this.state.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  toggleTheme() {
    this.state.darkMode = !this.state.darkMode;
    localStorage.setItem('medo_theme', this.state.darkMode ? 'dark' : 'light');
    this.initTheme();
    this.updateThemeIcons();
  },

  updateThemeIcons() {
    const icons = document.querySelectorAll('.theme-toggle-icon');
    icons.forEach(el => {
      el.setAttribute('data-lucide', this.state.darkMode ? 'sun' : 'moon');
    });
    if (window.lucide) lucide.createIcons();
  },

  checkAdminStatus() {
    const user = API.getStoredUser();
    const token = API.getToken();
    const adminLink = document.getElementById('admin-nav-button');
    if (adminLink) {
      if (token && user) {
        adminLink.innerHTML = `
          <a href="/admin" class="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 transition">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Admin Panel
          </a>
        `;
      } else {
        adminLink.innerHTML = `
          <a href="/admin/login" class="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <i data-lucide="shield" class="w-3.5 h-3.5 text-slate-500"></i>
            Admin Login
          </a>
        `;
      }
      if (window.lucide) lucide.createIcons();
    }
  },

  initRouter() {
    window.addEventListener('popstate', () => {
      this.route(window.location.pathname, false);
    });

    // Intercept internal links
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('#')) {
        return;
      }

      if (href.startsWith('/admin')) {
        e.preventDefault();
        window.history.pushState({}, '', href);
        AdminApp.handleRoute(href);
        return;
      }

      e.preventDefault();
      this.navigate(href);
    });

    // Handle initial route
    const currentPath = window.location.pathname || '/';
    if (currentPath.startsWith('/admin')) {
      AdminApp.handleRoute(currentPath);
    } else {
      this.route(currentPath, false);
    }
  },

  navigate(path) {
    window.history.pushState({}, '', path);
    this.route(path, true);
  },

  route(path, scrollToTop = true) {
    const bar = document.getElementById('reading-progress-bar');
    if (bar) bar.style.width = '0%';
    window.onscroll = null;

    if (scrollToTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.getElementById('admin-container').classList.add('hidden');
    document.getElementById('public-container').classList.remove('hidden');

    this.state.currentRoute = path;

    // Route matching
    if (path === '/' || path === '/articles') {
      this.renderHome();
    } else if (path.startsWith('/posts/')) {
      const slug = path.replace('/posts/', '').split('/')[0];
      this.renderPostDetail(slug);
    } else if (path === '/notes') {
      this.renderNotes();
    } else if (path.startsWith('/notes/')) {
      const slug = path.replace('/notes/', '').split('/')[0];
      this.renderNoteDetail(slug);
    } else if (path === '/categories') {
      this.renderCategories();
    } else if (path.startsWith('/categories/')) {
      const catSlug = path.replace('/categories/', '').split('/')[0];
      this.renderCategoryView(catSlug);
    } else if (path.startsWith('/tags/')) {
      const tagSlug = path.replace('/tags/', '').split('/')[0];
      this.renderTagView(tagSlug);
    } else if (path === '/about') {
      this.renderAbout();
    } else if (path === '/contact') {
      this.renderContact();
    } else if (path === '/privacy') {
      this.renderPrivacy();
    } else {
      this.renderNotFound();
    }

    this.updateActiveNavLinks(path);
  },

  updateActiveNavLinks(path) {
    document.querySelectorAll('.nav-link').forEach(el => {
      const href = el.getAttribute('href');
      if (
        (href === '/' && (path === '/' || path === '/articles')) ||
        (href === '/notes' && path.startsWith('/notes')) ||
        (href === '/categories' && path.startsWith('/categories')) ||
        (href === path)
      ) {
        el.classList.add('text-teal-600', 'dark:text-teal-400', 'font-semibold');
        el.classList.remove('text-slate-600', 'dark:text-slate-300');
      } else {
        el.classList.remove('text-teal-600', 'dark:text-teal-400', 'font-semibold');
        el.classList.add('text-slate-600', 'dark:text-slate-300');
      }
    });
  },

  initGlobalListeners() {
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.openSearchModal();
      }
      if (e.key === 'Escape') {
        this.closeSearchModal();
      }
    });
  },

  openSearchModal() {
    const modal = document.getElementById('search-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    const input = document.getElementById('modal-search-input');
    if (input) {
      input.value = '';
      input.focus();
      this.performModalSearch('');
    }
  },

  closeSearchModal() {
    const modal = document.getElementById('search-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  },

  // ==========================================
  // 1. HOME VIEW (ARTICLES & SPOTLIGHT)
  // ==========================================
  async renderHome() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="flex justify-center items-center py-24">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
      </div>
    `;

    try {
      const [featuredRes, postsRes, categoriesRes, tagsRes] = await Promise.all([
        API.getFeaturedPosts(),
        API.getPosts({
          page: this.state.currentPage,
          limit: this.state.postsPerPage,
          category: this.state.currentCategory,
          tag: this.state.currentTag,
          search: this.state.searchQuery
        }),
        API.getCategories(),
        API.getTags()
      ]);

      const featured = (featuredRes.featured || [])[0] || null;
      const posts = postsRes.posts || [];
      const pagination = postsRes.pagination || {};
      const categories = categoriesRes.categories || [];
      const tags = tagsRes.tags || [];

      let heroHtml = '';
      if (featured && !this.state.currentCategory && !this.state.currentTag && !this.state.searchQuery && this.state.currentPage === 1) {
        heroHtml = `
          <div class="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl mb-12 border border-slate-800">
            <div class="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/85 to-transparent z-10"></div>
            <img src="${featured.cover_image}" alt="${featured.title}" class="absolute inset-0 w-full h-full object-cover opacity-35 transform hover:scale-105 transition duration-700">
            <div class="relative z-20 p-8 sm:p-12 lg:p-16 max-w-3xl flex flex-col items-start">
              <div class="flex items-center gap-2 mb-4">
                <span class="px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-teal-500 text-white shadow-sm">Featured Medical Guide</span>
                <span class="text-xs font-medium text-slate-300">${featured.category_name || 'MBBS Prep'}</span>
              </div>
              <a href="/posts/${featured.slug}" class="group">
                <h1 class="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight mb-4 group-hover:text-teal-300 transition">
                  ${featured.title}
                </h1>
              </a>
              <p class="text-slate-300 text-base sm:text-lg mb-6 line-clamp-3 leading-relaxed">
                ${featured.excerpt}
              </p>
              <div class="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-400">
                <div class="flex items-center gap-2">
                  <img src="${featured.author_avatar || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100'}" alt="${featured.author_name}" class="w-7 h-7 rounded-full object-cover ring-2 ring-teal-500">
                  <span class="font-medium text-white">${featured.author_name}</span>
                </div>
                <span>•</span>
                <span>${this.formatDate(featured.published_at)}</span>
                <span>•</span>
                <span class="flex items-center gap-1"><i data-lucide="clock" class="w-3.5 h-3.5"></i> ${featured.read_time} min read</span>
                <span>•</span>
                <span class="flex items-center gap-1"><i data-lucide="eye" class="w-3.5 h-3.5"></i> ${featured.views} views</span>
              </div>
            </div>
          </div>

          <!-- Quick Access Notes Spotlight Card -->
          <div class="mb-12 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-teal-500/10 border border-teal-200 dark:border-teal-900/60 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-teal-500/30">
                <i data-lucide="book-open" class="w-7 h-7 text-white"></i>
              </div>
              <div>
                <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 mb-1">
                  ⚡ New Study Notes Panel
                </div>
                <h3 class="text-xl font-extrabold text-slate-900 dark:text-white">High-Yield MBBS Study Notes & Cheat Sheets</h3>
                <p class="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Filter by 1st, 2nd, 3rd, or Final Prof years. Anatomy, Pharm, Pathology, ECG algorithms & more.</p>
              </div>
            </div>
            <a href="/notes" class="flex-shrink-0 px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-600/30 flex items-center gap-2 transition hover:scale-105 transform">
              <span>Open Notes Hub</span>
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </a>
          </div>
        `;
      }

      main.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
          ${heroHtml}

          <!-- Header & Filter Bar -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                ${this.state.currentCategory ? `Topic: ${this.state.currentCategory}` : this.state.searchQuery ? `Search: "${this.state.searchQuery}"` : 'Clinical Articles & Guides'}
              </h2>
              <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Evidence-based medical education, case presentations, and ward survival advice.
              </p>
            </div>

            <!-- Search input in home -->
            <div class="flex items-center gap-2">
              <div class="relative w-full sm:w-72">
                <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3.5 top-3"></i>
                <input
                  type="text"
                  placeholder="Filter articles..."
                  value="${this.state.searchQuery}"
                  onkeydown="if(event.key==='Enter'){ App.state.searchQuery=this.value; App.state.currentPage=1; App.renderHome(); }"
                  class="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
                >
              </div>
              ${(this.state.currentCategory || this.state.currentTag || this.state.searchQuery) ? `
                <button onclick="App.clearFilters()" class="px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition font-medium flex items-center gap-1">
                  <i data-lucide="x" class="w-3.5 h-3.5"></i> Clear
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Category Pills -->
          <div class="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
            <button onclick="App.setCategoryFilter('')" class="px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${!this.state.currentCategory ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}">
              All Subjects
            </button>
            ${categories.map(c => `
              <button onclick="App.setCategoryFilter('${c.slug}')" class="px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${this.state.currentCategory === c.slug ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}">
                ${c.name} (${c.post_count})
              </button>
            `).join('')}
          </div>

          <!-- Articles Grid -->
          ${posts.length === 0 ? `
            <div class="p-16 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-center">
              <i data-lucide="file-question" class="w-12 h-12 text-slate-400 mx-auto mb-3"></i>
              <h3 class="text-lg font-bold text-slate-800 dark:text-slate-200">No medical articles found</h3>
              <p class="text-xs text-slate-500 mt-1 mb-4">Try clearing filters or searching another keyword.</p>
              <button onclick="App.clearFilters()" class="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold">Reset Filters</button>
            </div>
          ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-14">
              ${posts.map(p => this.renderPostCard(p)).join('')}
            </div>
          `}

          <!-- Pagination -->
          ${pagination.total_pages > 1 ? `
            <div class="flex items-center justify-center gap-2 mb-16">
              <button onclick="App.setPage(${pagination.page - 1})" ${pagination.page <= 1 ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="hover:bg-slate-100 dark:hover:bg-slate-800"'} class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold transition">
                Previous
              </button>
              <span class="px-4 py-2 text-xs font-mono text-slate-500">
                Page ${pagination.page} of ${pagination.total_pages}
              </span>
              <button onclick="App.setPage(${pagination.page + 1})" ${pagination.page >= pagination.total_pages ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="hover:bg-slate-100 dark:hover:bg-slate-800"'} class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold transition">
                Next
              </button>
            </div>
          ` : ''}

          <!-- Newsletter Section -->
          <div class="rounded-3xl p-8 sm:p-12 bg-slate-900 text-white relative overflow-hidden border border-slate-800">
            <div class="max-w-2xl relative z-10">
              <span class="px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-400 border border-teal-500/30 uppercase tracking-wider mb-3 inline-block">
                Weekly High-Yield Dispatch
              </span>
              <h3 class="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">Sharpen Your Clinical Acumen Every Sunday</h3>
              <p class="text-slate-300 text-sm mb-6 leading-relaxed">
                Join 10,000+ medical students and interns receiving our top clinical pearls, ECG breakdowns, Anki tips, and exam revision guides. No spam ever.
              </p>
              <form onsubmit="App.handleNewsletter(event)" class="flex flex-col sm:flex-row gap-3">
                <input type="email" required placeholder="Enter your student or university email..." class="flex-grow px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <button type="submit" class="px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-sm transition shadow-lg shadow-teal-600/30">
                  Subscribe Free
                </button>
              </form>
            </div>
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();

    } catch (err) {
      main.innerHTML = `
        <div class="max-w-md mx-auto py-24 text-center">
          <i data-lucide="alert-triangle" class="w-12 h-12 text-rose-500 mx-auto mb-3"></i>
          <h2 class="text-lg font-bold">Failed to load articles</h2>
          <p class="text-xs text-slate-500 mt-1 mb-4">${err.message || 'Server connection error'}</p>
          <button onclick="App.renderHome()" class="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl">Retry</button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    }
  },

  renderPostCard(p) {
    const isBookmarked = this.state.bookmarkedPosts.includes(p.id);
    return `
      <article class="group flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
        <a href="/posts/${p.slug}" class="relative aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-800 block">
          <img src="${p.cover_image || 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800'}" alt="${p.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
          <span class="absolute top-4 left-4 px-3 py-1 rounded-full text-[11px] font-bold text-white shadow-md backdrop-blur-md" style="background-color: ${p.category_color || '#0d9488'}">
            ${p.category_name || 'MBBS'}
          </span>
        </a>

        <div class="p-6 flex flex-col flex-grow">
          <div class="flex items-center gap-3 text-xs text-slate-400 mb-3">
            <span>${this.formatDate(p.published_at || p.created_at)}</span>
            <span>•</span>
            <span class="flex items-center gap-1"><i data-lucide="clock" class="w-3.5 h-3.5"></i> ${p.read_time} min</span>
            <span class="ml-auto">
              <button onclick="event.stopPropagation(); App.toggleBookmark(${p.id})" data-bookmark-id="${p.id}" class="p-1 hover:text-amber-500 transition" title="Bookmark article">
                <i data-lucide="bookmark" class="w-3.5 h-3.5 ${isBookmarked ? 'fill-current text-amber-500' : 'text-slate-400'}"></i>
              </button>
            </span>
          </div>

          <a href="/posts/${p.slug}">
            <h3 class="text-lg font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition line-clamp-2 leading-snug mb-2">
              ${p.title}
            </h3>
          </a>

          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed mb-4">
            ${p.excerpt || ''}
          </p>

          <div class="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <img src="${p.author_avatar || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100'}" alt="${p.author_name}" class="w-6 h-6 rounded-full object-cover">
              <span class="text-xs font-medium text-slate-700 dark:text-slate-300">${p.author_name || 'Dr. Anuja'}</span>
            </div>
            <div class="flex items-center gap-3 text-xs text-slate-400">
              <span class="flex items-center gap-1"><i data-lucide="eye" class="w-3.5 h-3.5"></i> ${p.views || 0}</span>
              <span class="flex items-center gap-1"><i data-lucide="heart" class="w-3.5 h-3.5"></i> ${p.likes_count || 0}</span>
            </div>
          </div>
        </div>
      </article>
    `;
  },

  // ==========================================
  // 2. DEDICATED STUDY NOTES VIEW (PANEL)
  // ==========================================
  async renderNotes() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="flex justify-center items-center py-24">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
      </div>
    `;

    try {
      const res = await API.getNotes({
        page: this.state.notesPage,
        limit: this.state.notesPerPage,
        subject: this.state.notesSubject,
        prof_year: this.state.notesProfYear,
        search: this.state.notesSearch,
        high_yield: this.state.notesHighYieldOnly ? '1' : ''
      });

      const notes = res.notes || [];
      const subjects = res.subjects || [];
      const pagination = res.pagination || {};

      const profYears = ['All', '1st Prof', '2nd Prof', '3rd Prof', 'Final Prof'];

      main.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
          <!-- Header Banner -->
          <div class="relative overflow-hidden rounded-3xl p-8 sm:p-12 bg-gradient-to-br from-teal-900 via-slate-900 to-cyan-950 text-white shadow-xl mb-10 border border-teal-900/60">
            <div class="max-w-3xl relative z-10">
              <div class="flex items-center gap-2 mb-3">
                <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  ⚡ High-Yield Medical Notes
                </span>
                <span class="text-xs text-slate-300">University Exam & USMLE / NEET-PG Ready</span>
              </div>
              <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
                Medo MBBS Study Notes & Clinical Pearls
              </h1>
              <p class="text-slate-300 text-sm sm:text-base leading-relaxed">
                Concise, high-yield clinical summaries, anatomical relations, pharmacology mnemonics, and diagnostic algorithms. Designed to turn 100-page chapters into 10-minute revisions.
              </p>
            </div>
          </div>

          <!-- Filters Section -->
          <div class="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 mb-8 space-y-5">
            <!-- Top Controls: Search & High-Yield Toggle -->
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="relative w-full sm:w-96">
                <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3.5 top-3"></i>
                <input
                  type="text"
                  placeholder="Search topic, condition, nerve, or drug..."
                  value="${this.state.notesSearch}"
                  onkeydown="if(event.key==='Enter'){ App.state.notesSearch=this.value; App.state.notesPage=1; App.renderNotes(); }"
                  class="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
                >
              </div>

              <!-- High Yield Only Toggle Button -->
              <div class="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  onclick="App.state.notesHighYieldOnly = !App.state.notesHighYieldOnly; App.state.notesPage=1; App.renderNotes();"
                  class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${this.state.notesHighYieldOnly ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400'}"
                >
                  <i data-lucide="zap" class="w-4 h-4 text-amber-300 fill-current"></i>
                  <span>High Yield Pearls Only</span>
                </button>

                ${(this.state.notesSubject || this.state.notesProfYear || this.state.notesSearch || this.state.notesHighYieldOnly) ? `
                  <button onclick="App.clearNotesFilters()" class="px-3 py-2 text-xs rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition font-medium flex items-center gap-1">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i> Clear
                  </button>
                ` : ''}
              </div>
            </div>

            <!-- Professional Year Tabs -->
            <div>
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Curriculum Phase / Year</div>
              <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                ${profYears.map(yr => {
                  const isActive = (yr === 'All' && !this.state.notesProfYear) || (this.state.notesProfYear === yr);
                  return `
                    <button
                      onclick="App.state.notesProfYear = '${yr === 'All' ? '' : yr}'; App.state.notesPage=1; App.renderNotes();"
                      class="px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${isActive ? 'bg-teal-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}"
                    >
                      ${yr}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Subject Pills -->
            <div>
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Filter by Medical Subject</div>
              <div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <button
                  onclick="App.state.notesSubject = ''; App.state.notesPage=1; App.renderNotes();"
                  class="px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${!this.state.notesSubject ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'}"
                >
                  All Subjects
                </button>
                ${subjects.map(s => `
                  <button
                    onclick="App.state.notesSubject = '${s.subject}'; App.state.notesPage=1; App.renderNotes();"
                    class="px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${this.state.notesSubject.toLowerCase() === s.subject.toLowerCase() ? 'bg-teal-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'}"
                  >
                    ${s.subject} <span class="opacity-70 text-[10px]">(${s.count})</span>
                  </button>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Notes Grid -->
          ${notes.length === 0 ? `
            <div class="p-16 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-center">
              <i data-lucide="book-open" class="w-12 h-12 text-slate-400 mx-auto mb-3"></i>
              <h3 class="text-lg font-bold text-slate-800 dark:text-slate-200">No study notes match your filters</h3>
              <p class="text-xs text-slate-500 mt-1 mb-4">Try clearing filters or selecting another subject.</p>
              <button onclick="App.clearNotesFilters()" class="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold">Reset Notes Filters</button>
            </div>
          ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              ${notes.map(n => this.renderNoteCard(n)).join('')}
            </div>
          `}

          <!-- Pagination -->
          ${pagination.total_pages > 1 ? `
            <div class="flex items-center justify-center gap-2 mb-16">
              <button onclick="App.state.notesPage = ${pagination.page - 1}; App.renderNotes();" ${pagination.page <= 1 ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="hover:bg-slate-100 dark:hover:bg-slate-800"'} class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold transition">
                Previous
              </button>
              <span class="px-4 py-2 text-xs font-mono text-slate-500">
                Page ${pagination.page} of ${pagination.total_pages}
              </span>
              <button onclick="App.state.notesPage = ${pagination.page + 1}; App.renderNotes();" ${pagination.page >= pagination.total_pages ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="hover:bg-slate-100 dark:hover:bg-slate-800"'} class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold transition">
                Next
              </button>
            </div>
          ` : ''}
        </div>
      `;

      if (window.lucide) lucide.createIcons();

    } catch (err) {
      main.innerHTML = `
        <div class="max-w-md mx-auto py-24 text-center">
          <i data-lucide="alert-triangle" class="w-12 h-12 text-rose-500 mx-auto mb-3"></i>
          <h2 class="text-lg font-bold">Failed to load study notes</h2>
          <p class="text-xs text-slate-500 mt-1 mb-4">${err.message || 'Server connection error'}</p>
          <button onclick="App.renderNotes()" class="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl">Retry</button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    }
  },

  renderNoteCard(n) {
    return `
      <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between">
        <div>
          <!-- Badges -->
          <div class="flex items-center gap-2 mb-3 flex-wrap">
            <span class="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              ${n.subject}
            </span>
            <span class="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              ${n.prof_year}
            </span>
            ${n.is_high_yield ? `
              <span class="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                <i data-lucide="zap" class="w-3 h-3 fill-current text-amber-500"></i> HIGH YIELD
              </span>
            ` : ''}
          </div>

          <!-- Topic -->
          ${n.topic ? `<div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">${n.topic}</div>` : ''}

          <!-- Title -->
          <a href="/notes/${n.slug}">
            <h3 class="text-lg font-bold text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition mb-3 line-clamp-2 leading-snug">
              ${n.title}
            </h3>
          </a>

          <!-- Summary points -->
          <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3 mb-6">
            ${n.summary || ''}
          </p>
        </div>

        <div class="pt-4 border-t border-slate-100 dark:border-slate-800">
          <div class="flex items-center justify-between text-xs text-slate-400 mb-4">
            <span class="flex items-center gap-1"><i data-lucide="clock" class="w-3.5 h-3.5"></i> ${n.read_time || 5}m review</span>
            <span class="flex items-center gap-1"><i data-lucide="eye" class="w-3.5 h-3.5"></i> ${n.views || 0}</span>
            <span class="flex items-center gap-1"><i data-lucide="download" class="w-3.5 h-3.5"></i> ${n.downloads_count || 0}</span>
          </div>

          <div class="flex items-center gap-2">
            <a href="/notes/${n.slug}" class="flex-grow py-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-600 hover:text-white text-teal-700 dark:text-teal-300 font-bold text-xs text-center transition flex items-center justify-center gap-1.5 border border-teal-200 dark:border-teal-800/80">
              <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Read Note
            </a>
            ${n.download_url ? `
              <button onclick="App.handleNoteDownload(${n.id}, '${n.download_url}')" class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition" title="Download Resource">
                <i data-lucide="download" class="w-4 h-4"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  clearNotesFilters() {
    this.state.notesSubject = '';
    this.state.notesProfYear = '';
    this.state.notesSearch = '';
    this.state.notesHighYieldOnly = false;
    this.state.notesPage = 1;
    this.renderNotes();
  },

  async handleNoteDownload(noteId, url) {
    try {
      await API.incrementNoteDownload(noteId);
      showToast("Downloading resource...", "success");
      window.open(url, '_blank');
    } catch {
      window.open(url, '_blank');
    }
  },

  // ==========================================
  // 3. SINGLE NOTE DETAIL VIEW
  // ==========================================
  async renderNoteDetail(slug) {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="flex justify-center items-center py-24">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
      </div>
    `;

    try {
      const res = await API.getNote(slug);
      const note = res.note;
      const related = res.related_notes || [];

      // Render Markdown content
      const renderedContent = this.parseMarkdown(note.content);

      main.innerHTML = `
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
          <!-- Breadcrumb -->
          <nav class="flex items-center gap-2 text-xs text-slate-400 mb-6">
            <a href="/" class="hover:text-teal-600">Home</a>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            <a href="/notes" class="hover:text-teal-600">Study Notes</a>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            <span class="text-slate-600 dark:text-slate-300 font-medium">${note.subject}</span>
          </nav>

          <!-- Note Meta Header -->
          <header class="mb-8">
            <div class="flex items-center gap-2.5 mb-3 flex-wrap">
              <span class="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                ${note.subject}
              </span>
              <span class="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                ${note.prof_year}
              </span>
              ${note.is_high_yield ? `
                <span class="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                  <i data-lucide="zap" class="w-3.5 h-3.5 fill-current text-amber-500"></i> HIGH-YIELD EXAM PEARL
                </span>
              ` : ''}
              ${note.topic ? `<span class="text-xs text-slate-400 font-medium">Topic: ${note.topic}</span>` : ''}
            </div>

            <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight mb-4">
              ${note.title}
            </h1>

            <div class="flex items-center justify-between py-4 border-y border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              <div class="flex items-center gap-4">
                <span>By <strong>Dr. Anuja</strong> (Medo Editorial)</span>
                <span>•</span>
                <span class="flex items-center gap-1"><i data-lucide="clock" class="w-3.5 h-3.5"></i> ${note.read_time} min read</span>
                <span>•</span>
                <span class="flex items-center gap-1"><i data-lucide="eye" class="w-3.5 h-3.5"></i> ${note.views} views</span>
              </div>

              <div class="flex items-center gap-2">
                <button onclick="App.copyLink()" class="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-teal-600 transition" title="Copy Link">
                  <i data-lucide="link" class="w-4 h-4"></i>
                </button>
                ${note.download_url ? `
                  <button onclick="App.handleNoteDownload(${note.id}, '${note.download_url}')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition">
                    <i data-lucide="download" class="w-3.5 h-3.5"></i>
                    <span>Download Resource</span>
                  </button>
                ` : ''}
              </div>
            </div>
          </header>

          <!-- High-Yield Recall Card -->
          ${note.summary ? `
            <div class="p-6 rounded-3xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 mb-10">
              <div class="flex items-center gap-2 text-teal-800 dark:text-teal-300 font-bold text-sm mb-2">
                <i data-lucide="sparkles" class="w-4 h-4"></i> High-Yield Summary & Quick Revision Takeaways
              </div>
              <p class="text-sm text-teal-950 dark:text-teal-100 leading-relaxed font-medium">
                ${note.summary}
              </p>
            </div>
          ` : ''}

          <!-- Note Content -->
          <article class="prose-medo mb-16">
            ${renderedContent}
          </article>

          <!-- Download Action Banner -->
          <div class="p-8 rounded-3xl bg-slate-900 text-white mb-16 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h4 class="text-lg font-bold">Found this note helpful?</h4>
              <p class="text-xs text-slate-300 mt-1">Download this revision guide or explore more high-yield topics in ${note.subject}.</p>
            </div>
            <div class="flex items-center gap-3">
              <a href="/notes" class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold transition">
                All Notes
              </a>
              ${note.download_url ? `
                <button onclick="App.handleNoteDownload(${note.id}, '${note.download_url}')" class="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition flex items-center gap-1.5">
                  <i data-lucide="download" class="w-3.5 h-3.5"></i> Download PDF
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Related Notes in Subject -->
          ${related.length > 0 ? `
            <div class="pt-8 border-t border-slate-100 dark:border-slate-800">
              <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-6">More High-Yield Notes in ${note.subject}</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                ${related.map(r => `
                  <a href="/notes/${r.slug}" class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-teal-400 transition group flex flex-col justify-between">
                    <div>
                      <div class="flex items-center gap-2 mb-2">
                        <span class="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase">${r.prof_year}</span>
                        ${r.is_high_yield ? '<span class="text-[10px] text-amber-500 font-bold">⚡ High-Yield</span>' : ''}
                      </div>
                      <h4 class="font-bold text-sm text-slate-900 dark:text-white group-hover:text-teal-600 transition mb-1">${r.title}</h4>
                      <p class="text-xs text-slate-400">${r.topic || ''}</p>
                    </div>
                    <div class="text-xs text-teal-600 font-semibold mt-3 flex items-center gap-1">Read note <i data-lucide="arrow-right" class="w-3 h-3"></i></div>
                  </a>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;

      if (window.hljs) {
        document.querySelectorAll('pre code').forEach((block) => {
          hljs.highlightElement(block);
        });
      }

      if (window.lucide) lucide.createIcons();

    } catch (err) {
      this.renderNotFound();
    }
  },

  // ==========================================
  // 4. ARTICLE DETAIL VIEW (BLOG)
  // ==========================================
  async renderPostDetail(slug) {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="flex justify-center items-center py-24">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
      </div>
    `;

    try {
      const res = await API.getPost(slug);
      const p = res.post;
      const isLiked = this.state.likedPosts.includes(p.id);
      const isBookmarked = this.state.bookmarkedPosts.includes(p.id);

      // Reading progress bar setup
      window.onscroll = () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        const bar = document.getElementById('reading-progress-bar');
        if (bar) bar.style.width = scrolled + '%';
      };

      const renderedContent = this.parseMarkdown(p.content);

      main.innerHTML = `
        <article class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
          <!-- Breadcrumb -->
          <nav class="flex items-center gap-2 text-xs text-slate-400 mb-6">
            <a href="/" class="hover:text-teal-600">Home</a>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            <a href="/categories" class="hover:text-teal-600">Topics</a>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            <span class="text-slate-600 dark:text-slate-300 font-medium">${p.category?.name || 'General'}</span>
          </nav>

          <!-- Post Header -->
          <header class="mb-10 text-center max-w-3xl mx-auto">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-teal-700 bg-teal-50 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800 mb-4">
              <span>${p.category?.name || 'Clinical Article'}</span>
            </div>

            <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight mb-6">
              ${p.title}
            </h1>

            <p class="text-base sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
              ${p.excerpt || ''}
            </p>

            <div class="flex items-center justify-center gap-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              <div class="flex items-center gap-2">
                <img src="${p.author?.avatar || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100'}" alt="${p.author?.name}" class="w-8 h-8 rounded-full object-cover ring-2 ring-teal-500">
                <span class="font-bold text-slate-800 dark:text-slate-200">${p.author?.name || 'Dr. Anuja'}</span>
              </div>
              <span>•</span>
              <span>${this.formatDate(p.published_at || p.created_at)}</span>
              <span>•</span>
              <span class="flex items-center gap-1"><i data-lucide="clock" class="w-3.5 h-3.5"></i> ${p.read_time} min read</span>
              <span>•</span>
              <span class="flex items-center gap-1"><i data-lucide="eye" class="w-3.5 h-3.5"></i> ${p.views} views</span>
            </div>
          </header>

          <!-- Cover Image -->
          ${p.cover_image ? `
            <div class="relative aspect-[16/9] rounded-3xl overflow-hidden mb-12 shadow-2xl">
              <img src="${p.cover_image}" alt="${p.title}" class="w-full h-full object-cover">
            </div>
          ` : ''}

          <!-- Floating Sticky Social / Action Bar -->
          <div class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 mb-12">
            <div class="flex items-center gap-3">
              <button id="like-btn" onclick="App.handleLikePost(${p.id})" class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${isLiked ? 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-rose-600 shadow-sm'}">
                <i data-lucide="heart" class="w-4 h-4 ${isLiked ? 'fill-current text-rose-600' : ''}"></i>
                <span id="likes-count">${p.likes_count}</span>
              </button>

              <button id="bookmark-btn" onclick="App.toggleBookmark(${p.id})" class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${isBookmarked ? 'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/40' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-amber-500 shadow-sm'}">
                <i data-lucide="bookmark" class="w-4 h-4 ${isBookmarked ? 'fill-current text-amber-500' : ''}"></i>
                <span class="hidden sm:inline">${isBookmarked ? 'Saved' : 'Save'}</span>
              </button>
            </div>

            <div class="flex items-center gap-2">
              <button onclick="App.shareSocial('twitter', '${encodeURIComponent(p.title)}')" class="p-2 rounded-xl bg-white dark:bg-slate-800 hover:text-teal-600 shadow-sm" title="Share to X">
                <i data-lucide="twitter" class="w-4 h-4"></i>
              </button>
              <button onclick="App.shareSocial('linkedin', '${encodeURIComponent(p.title)}')" class="p-2 rounded-xl bg-white dark:bg-slate-800 hover:text-teal-600 shadow-sm" title="Share to LinkedIn">
                <i data-lucide="linkedin" class="w-4 h-4"></i>
              </button>
              <button onclick="App.copyLink()" class="p-2 rounded-xl bg-white dark:bg-slate-800 hover:text-teal-600 shadow-sm" title="Copy Link">
                <i data-lucide="link" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <!-- Article Content -->
          <div class="prose-medo mb-16">
            ${renderedContent}
          </div>

          <!-- Tags -->
          ${(p.tags || []).length > 0 ? `
            <div class="flex items-center gap-2 flex-wrap mb-12 pt-6 border-t border-slate-100 dark:border-slate-800">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">Medical Tags:</span>
              ${p.tags.map(t => `
                <a href="/tags/${t.slug}" class="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-teal-50 hover:text-teal-600 transition">
                  #${t.name}
                </a>
              `).join('')}
            </div>
          ` : ''}

          <!-- Author Bio Card -->
          <div class="p-8 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-16">
            <img src="${p.author?.avatar || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200'}" alt="${p.author?.name}" class="w-20 h-20 rounded-2xl object-cover ring-4 ring-teal-500/20 flex-shrink-0">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <h4 class="text-lg font-bold text-slate-900 dark:text-white">${p.author?.name || 'Dr. Anuja'}</h4>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">Editor-in-Chief</span>
              </div>
              <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                ${p.author?.bio || 'MBBS Scholar & Clinical Resident. Creator of Medo. Committed to simplifying medical complexity into clear, memorable clinical frameworks.'}
              </p>
              <div class="flex items-center gap-3 text-slate-400">
                <a href="https://twitter.com" target="_blank" class="hover:text-teal-600"><i data-lucide="twitter" class="w-4 h-4"></i></a>
                <a href="https://github.com" target="_blank" class="hover:text-teal-600"><i data-lucide="github" class="w-4 h-4"></i></a>
                <a href="https://linkedin.com" target="_blank" class="hover:text-teal-600"><i data-lucide="linkedin" class="w-4 h-4"></i></a>
              </div>
            </div>
          </div>

          <!-- Comments Section -->
          <section class="mb-16">
            <h3 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-6">
              Clinical Discussion (${(p.comments || []).length})
            </h3>

            <!-- Comment Form -->
            <form onsubmit="App.handlePostComment(event, ${p.id})" class="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 mb-8">
              <h4 class="text-sm font-bold mb-4">Join the medical discussion</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <input type="text" name="name" required placeholder="Your Name or Medical Title (e.g., Dr. Priya / Kabir, 3rd Prof)" class="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500">
                <input type="email" name="email" required placeholder="Your email (kept private)" class="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500">
              </div>
              <textarea name="content" required rows="3" placeholder="Share your clinical experience, mnemonic, or question on this topic..." class="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4"></textarea>
              <button type="submit" class="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-md shadow-teal-600/25 transition">
                Post Comment
              </button>
            </form>

            <!-- Comments List -->
            <div id="comments-list" class="space-y-4">
              ${(p.comments || []).length === 0 ? `
                <div class="text-center py-8 text-slate-400 text-xs">Be the first medical student or doctor to comment!</div>
              ` : p.comments.map(c => `
                <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex gap-4">
                  <img src="${c.author_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.author_name)}`}" alt="${c.author_name}" class="w-10 h-10 rounded-full object-cover flex-shrink-0">
                  <div class="flex-grow">
                    <div class="flex items-center justify-between mb-1">
                      <div class="font-bold text-sm text-slate-900 dark:text-white">${c.author_name}</div>
                      <div class="text-xs text-slate-400">${this.formatDate(c.created_at)}</div>
                    </div>
                    <p class="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">${c.content}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>

          <!-- Related Posts -->
          ${(p.related_posts || []).length > 0 ? `
            <div class="pt-8 border-t border-slate-100 dark:border-slate-800">
              <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-6">Related Medical Guides</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                ${p.related_posts.map(r => `
                  <a href="/posts/${r.slug}" class="group block rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition">
                    <img src="${r.cover_image || 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600'}" class="w-full aspect-[16/9] object-cover group-hover:scale-105 transition duration-500">
                    <div class="p-4">
                      <span class="text-[10px] font-bold text-teal-600 uppercase mb-1 block">${r.category_name || 'MBBS'}</span>
                      <h4 class="font-bold text-sm text-slate-900 dark:text-white group-hover:text-teal-600 transition line-clamp-2">${r.title}</h4>
                    </div>
                  </a>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </article>
      `;

      if (window.hljs) {
        document.querySelectorAll('pre code').forEach((block) => {
          hljs.highlightElement(block);
        });
      }

      if (window.lucide) lucide.createIcons();

    } catch (err) {
      this.renderNotFound();
    }
  },

  // ==========================================
  // 5. SUBJECT DIRECTORY VIEW
  // ==========================================
  async renderCategories() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="flex justify-center items-center py-24">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
      </div>
    `;

    try {
      const res = await API.getCategories();
      const categories = res.categories || [];

      main.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
          <div class="max-w-2xl mb-12">
            <span class="px-3.5 py-1 text-xs font-semibold rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300 mb-3 inline-block">Curriculum Directory</span>
            <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">MBBS Subjects & Specialty Topics</h1>
            <p class="text-slate-600 dark:text-slate-300 text-base leading-relaxed">
              Explore medical articles, clinical OSCE pearls, and comprehensive notes organized by medical disciplines from 1st Year to Final Year Internship.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            ${categories.map(c => `
              <div onclick="App.setCategoryFilter('${c.slug}')" class="cursor-pointer group p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-md" style="background-color: ${c.color}20; color: ${c.color}">
                  <i data-lucide="${c.icon || 'activity'}" class="w-6 h-6"></i>
                </div>
                <h3 class="text-xl font-bold text-slate-900 dark:text-white group-hover:text-teal-600 transition mb-2">${c.name}</h3>
                <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">${c.description || 'Explore the latest medical guides and notes in this discipline.'}</p>
                <div class="flex items-center justify-between text-xs font-semibold text-teal-600 dark:text-teal-400 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <span>${c.post_count} Articles</span>
                  <span class="flex items-center gap-1 group-hover:translate-x-1 transition">Browse <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i></span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();
    } catch (e) {
      showToast("Failed to load categories", "error");
    }
  },

  // ==========================================
  // 6. ABOUT MEDO VIEW
  // ==========================================
  renderAbout() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 animate-fade-in">
        <!-- Hero -->
        <div class="text-center max-w-3xl mx-auto mb-16">
          <span class="px-3.5 py-1 text-xs font-semibold rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300 mb-4 inline-block">About Medo MBBS</span>
          <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight mb-6">
            Making Medical Education High-Yield, Accessible & Human
          </h1>
          <p class="text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed">
            Medo is an open, peer-driven medical student journal and high-yield study hub founded by Dr. Anuja. We synthesize massive medical textbooks into intuitive clinical frameworks.
          </p>
        </div>

        <!-- Metrics Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 p-8 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 mb-16 text-center">
          <div>
            <div class="text-3xl sm:text-4xl font-extrabold text-teal-600 dark:text-teal-400 mb-1">10,000+</div>
            <div class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Medical Students Reading</div>
          </div>
          <div class="border-y sm:border-y-0 sm:border-x border-slate-200 dark:border-slate-700 py-4 sm:py-0">
            <div class="text-3xl sm:text-4xl font-extrabold text-teal-600 dark:text-teal-400 mb-1">100%</div>
            <div class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Free & High-Yield Revisions</div>
          </div>
          <div>
            <div class="text-3xl sm:text-4xl font-extrabold text-teal-600 dark:text-teal-400 mb-1">19 Subjects</div>
            <div class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Pre-Clinical & Clinical Coverage</div>
          </div>
        </div>

        <!-- Mission Content -->
        <div class="prose-medo mb-16">
          <h2>Our Core Philosophy</h2>
          <p>
            The medical school curriculum is famous for information overload. Students are expected to absorb Guyton, Gray's Anatomy, Robbins Pathology, and Harrison's Internal Medicine within a matter of semesters. Without structured cognitive models and spaced repetition, knowledge evaporates.
          </p>
          
          <h3>What Sets Medo Apart</h3>
          <ul>
            <li><strong>Clinical Relevance:</strong> Every anatomical relation and pharmacological pathway is connected directly to bedside pathology and patient care.</li>
            <li><strong>Active Recall & Anki-First:</strong> We believe in flashcards, self-testing, and high-yield bulleted summaries over passive textbook re-reading.</li>
            <li><strong>Zero Pretentiousness:</strong> Written by students and residents who are living the grueling realities of ward rounds, 24-hour trauma shifts, and exam stress.</li>
          </ul>
        </div>

        <!-- Editorial Team -->
        <div class="mb-16">
          <h2 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-8 text-center">Medo Editorial Desk</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center gap-4">
              <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200" alt="Dr. Anuja" class="w-16 h-16 rounded-full object-cover ring-2 ring-teal-500">
              <div>
                <h4 class="font-bold text-slate-900 dark:text-white">Dr. Anuja</h4>
                <p class="text-xs text-teal-600 dark:text-teal-400 font-semibold mb-1">Founder & Lead Editor</p>
                <p class="text-xs text-slate-500">MBBS Scholar & Clinical Resident. Obsessed with high-yield recall, Anki systems, and cardiology.</p>
              </div>
            </div>
            <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center gap-4">
              <img src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200" alt="Dr. Rohan Mehta" class="w-16 h-16 rounded-full object-cover ring-2 ring-cyan-500">
              <div>
                <h4 class="font-bold text-slate-900 dark:text-white">Dr. Rohan Mehta</h4>
                <p class="text-xs text-teal-600 dark:text-teal-400 font-semibold mb-1">Surgery Contributor</p>
                <p class="text-xs text-slate-500">Emergency & General Surgery Resident. Passionate about trauma protocols and bedside OSCE teaching.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  // ==========================================
  // 7. CONTACT & INQUIRY VIEW
  // ==========================================
  renderContact() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 animate-fade-in">
        <div class="text-center max-w-2xl mx-auto mb-12">
          <span class="px-3.5 py-1 text-xs font-semibold rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300 mb-3 inline-block">Get in Touch</span>
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">Medo Editorial Desk</h1>
          <p class="text-slate-600 dark:text-slate-300 text-base">
            Have a clinical case presentation to share, study notes feedback, a mnemonic suggestion, or a peer collaboration idea? Reach out to Dr. Anuja and the Medo team.
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div class="lg:col-span-2 p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl">
            <form onsubmit="App.handleContactSubmit(event)">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Your Name *</label>
                  <input type="text" name="name" required placeholder="Dr. Sarah / Alex (MBBS 2nd Year)" class="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address *</label>
                  <input type="email" name="email" required placeholder="alex@medschool.edu" class="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject *</label>
                  <input type="text" name="subject" required placeholder="Note Correction / Case Study Submission" class="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select name="category" class="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="notes_feedback">Notes Feedback / Suggestion</option>
                    <option value="case_submission">Clinical Case Submission</option>
                    <option value="editorial">Editorial Question</option>
                    <option value="mentorship">Med Student Mentorship</option>
                  </select>
                </div>
              </div>

              <div class="mb-6">
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Your Message *</label>
                <textarea name="message" required rows="5" placeholder="Write your message or case summary here..." class="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"></textarea>
              </div>

              <button type="submit" class="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2">
                <i data-lucide="send" class="w-4 h-4"></i>
                <span>Send Message to Medo</span>
              </button>
            </form>
          </div>

          <!-- Contact Sidebar -->
          <div class="space-y-6">
            <div class="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <h4 class="font-bold text-sm mb-3">Direct Inquiries</h4>
              <p class="text-xs text-slate-500 leading-relaxed mb-4">
                We review case study submissions and study note suggestions weekly.
              </p>
              <div class="text-xs space-y-2 text-slate-600 dark:text-slate-400">
                <div><strong>Email:</strong> editor@medo.com</div>
                <div><strong>Location:</strong> University Medical Center</div>
                <div><strong>Response Time:</strong> Within 48 hours</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  // ==========================================
  // 8. PRIVACY POLICY
  // ==========================================
  renderPrivacy() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 animate-fade-in prose-medo">
        <h1>Medo Privacy Policy & Medical Disclaimer</h1>
        <p>Last updated: October 2026</p>
        
        <div class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
          <strong>Important Medical Education Disclaimer:</strong> Medo is designed strictly for medical students, healthcare trainees, and educational purposes. Content on this site does not constitute clinical medical advice for individual patients. Always refer to official national clinical guidelines and institutional protocols in patient care.
        </div>

        <h2>Information We Collect</h2>
        <p>Medo respects student privacy. We only collect information you voluntarily provide, such as your email address when subscribing to the weekly dispatch or submitting comments.</p>

        <h2>Security & Authentication</h2>
        <p>Admin authentication is strictly isolated with cryptographic salted PBKDF2 hashing, rate-limiting against automated brute force, and secure HTTP session cookies.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  },

  // 9. 404 NOT FOUND
  renderNotFound() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="max-w-md mx-auto py-24 px-4 text-center animate-fade-in">
        <div class="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400">
          <i data-lucide="file-question" class="w-8 h-8"></i>
        </div>
        <h2 class="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">Page Not Found</h2>
        <p class="text-slate-600 dark:text-slate-400 text-sm mb-8">The medical guide or note you are looking for may have been moved or updated.</p>
        <a href="/" class="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm transition shadow-lg shadow-teal-600/20">
          <i data-lucide="arrow-left" class="w-4 h-4"></i> Return to Medo Home
        </a>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  },

  // Filters & Action Handlers
  setCategoryFilter(catSlug) {
    this.state.currentCategory = catSlug;
    this.state.currentPage = 1;
    this.navigate('/');
  },

  setTagFilter(tagSlug) {
    this.state.currentTag = tagSlug;
    this.state.currentPage = 1;
    this.navigate('/');
  },

  setPage(page) {
    this.state.currentPage = page;
    this.renderHome();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  clearFilters() {
    this.state.currentCategory = '';
    this.state.currentTag = '';
    this.state.searchQuery = '';
    this.state.currentPage = 1;
    this.renderHome();
  },

  async handleLikePost(postId) {
    if (this.state.likedPosts.includes(postId)) {
      showToast("You've already liked this article!", "info");
      return;
    }

    try {
      const res = await API.likePost(postId);
      this.state.likedPosts.push(postId);
      localStorage.setItem('medo_liked_posts', JSON.stringify(this.state.likedPosts));
      
      const countEl = document.getElementById('likes-count');
      if (countEl) countEl.innerText = res.likes_count;

      const btn = document.getElementById('like-btn');
      if (btn) {
        btn.classList.add('bg-rose-50', 'text-rose-600', 'border', 'border-rose-200');
        const icon = btn.querySelector('i');
        if (icon) icon.classList.add('fill-current');
      }

      if (window.confetti) {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
      }

      showToast("Thank you for your appreciation!", "success");
    } catch (e) {
      showToast("Failed to record like", "error");
    }
  },

  toggleBookmark(postId) {
    const numericId = parseInt(postId, 10);
    const index = this.state.bookmarkedPosts.indexOf(numericId);
    let isAdded = false;
    if (index > -1) {
      this.state.bookmarkedPosts.splice(index, 1);
      showToast("Removed from saved articles", "info");
    } else {
      this.state.bookmarkedPosts.push(numericId);
      isAdded = true;
      showToast("Saved to your clinical library", "success");
    }
    localStorage.setItem('medo_bookmarks', JSON.stringify(this.state.bookmarkedPosts));

    const btn = document.getElementById('bookmark-btn');
    if (btn) {
      if (isAdded) {
        btn.className = 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800';
        btn.innerHTML = `<i data-lucide="bookmark" class="w-4 h-4 fill-current text-amber-600"></i><span class="hidden sm:inline">Saved</span>`;
      } else {
        btn.className = 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 hover:text-amber-600 text-slate-700 dark:text-slate-200';
        btn.innerHTML = `<i data-lucide="bookmark" class="w-4 h-4"></i><span class="hidden sm:inline">Save</span>`;
      }
    }

    const cardBtns = document.querySelectorAll(`[data-bookmark-id="${numericId}"]`);
    cardBtns.forEach(b => {
      if (isAdded) {
        b.innerHTML = `<i data-lucide="bookmark" class="w-3.5 h-3.5 fill-current text-amber-500"></i>`;
      } else {
        b.innerHTML = `<i data-lucide="bookmark" class="w-3.5 h-3.5 text-slate-400"></i>`;
      }
    });
    if (window.lucide) lucide.createIcons();
  },

  parseMarkdown(text) {
    if (!text) return '';
    if (window.marked) {
      try {
        return marked.parse(text);
      } catch (e) {
        console.warn('marked parse error:', e);
      }
    }
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/\n\n/gim, '<p></p>')
      .replace(/\n/gim, '<br>');
  },

  async handlePostComment(e, postId) {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const content = form.content.value.trim();

    try {
      const res = await API.addComment(postId, { name, email, content });
      showToast(res.message || "Comment posted!", "success");
      form.reset();

      const list = document.getElementById('comments-list');
      if (list && res.comment) {
        const c = res.comment;
        const newComm = document.createElement('div');
        newComm.className = 'p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex gap-4 animate-fade-in';
        newComm.innerHTML = `
          <img src="${c.author_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.author_name)}`}" alt="${c.author_name}" class="w-10 h-10 rounded-full object-cover flex-shrink-0">
          <div class="flex-grow">
            <div class="flex items-center justify-between mb-1">
              <div class="font-bold text-sm text-slate-900 dark:text-white">${c.author_name}</div>
              <div class="text-xs text-slate-400">Just now</div>
            </div>
            <p class="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">${c.content}</p>
          </div>
        `;
        list.prepend(newComm);
      }
    } catch (err) {
      showToast(err.message || "Failed to post comment", "error");
    }
  },

  async handleNewsletter(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.querySelector('input[type="email"]').value.trim();
    try {
      const res = await API.subscribeNewsletter(email);
      showToast(res.message || "Subscribed successfully!", "success");
      form.reset();
    } catch (err) {
      showToast(err.message || "Subscription failed", "error");
    }
  },

  async handleContactSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      subject: form.subject.value.trim(),
      category: form.category.value,
      message: form.message.value.trim()
    };

    try {
      const res = await API.sendContactMessage(formData);
      showToast(res.message || "Message sent successfully!", "success");
      form.reset();
    } catch (err) {
      showToast(err.message || "Failed to send message", "error");
    }
  },

  shareSocial(network, title) {
    const url = encodeURIComponent(window.location.href);
    let shareUrl = '';
    if (network === 'twitter') {
      shareUrl = `https://twitter.com/intent/tweet?text=${title}&url=${url}`;
    } else if (network === 'linkedin') {
      shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    }
    if (shareUrl) window.open(shareUrl, '_blank', 'width=600,height=500');
  },

  copyLink() {
    navigator.clipboard.writeText(window.location.href);
    showToast("Link copied to clipboard!", "success");
  },

  // Instant Modal Search across articles and notes
  modalDebounceTimer: null,
  performModalSearch(query) {
    clearTimeout(this.modalDebounceTimer);
    const resultsContainer = document.getElementById('modal-search-results');
    if (!resultsContainer) return;

    this.modalDebounceTimer = setTimeout(async () => {
      try {
        const [postsRes, notesRes] = await Promise.all([
          API.getPosts({ search: query, limit: 4 }),
          API.getNotes({ search: query, limit: 4 })
        ]);

        const posts = postsRes.posts || [];
        const notes = notesRes.notes || [];

        if (posts.length === 0 && notes.length === 0) {
          resultsContainer.innerHTML = `
            <div class="py-12 text-center text-slate-400 text-sm">
              No matching medical articles or notes found.
            </div>
          `;
          return;
        }

        let html = '';

        if (notes.length > 0) {
          html += `<div class="px-3 py-1.5 text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">⚡ Study Notes</div>`;
          html += notes.map(n => `
            <a href="/notes/${n.slug}" onclick="App.closeSearchModal()" class="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <div class="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 flex items-center justify-center text-teal-600 flex-shrink-0">
                <i data-lucide="book-open" class="w-5 h-5"></i>
              </div>
              <div class="flex-grow min-w-0">
                <div class="text-[10px] font-bold text-teal-600 dark:text-teal-400">${n.subject} • ${n.prof_year}</div>
                <h4 class="text-sm font-bold text-slate-900 dark:text-white truncate">${n.title}</h4>
              </div>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400"></i>
            </a>
          `).join('');
        }

        if (posts.length > 0) {
          html += `<div class="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2">Clinical Articles</div>`;
          html += posts.map(p => `
            <a href="/posts/${p.slug}" onclick="App.closeSearchModal()" class="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <img src="${p.cover_image || 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=100'}" alt="${p.title}" class="w-10 h-10 rounded-xl object-cover flex-shrink-0">
              <div class="flex-grow min-w-0">
                <div class="text-[10px] font-bold text-slate-500">${p.category_name || 'Article'}</div>
                <h4 class="text-sm font-bold text-slate-900 dark:text-white truncate">${p.title}</h4>
              </div>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400"></i>
            </a>
          `).join('');
        }

        resultsContainer.innerHTML = html;
        if (window.lucide) lucide.createIcons();
      } catch (e) {
        resultsContainer.innerHTML = `<div class="py-6 text-center text-rose-500 text-xs">Error searching database.</div>`;
      }
    }, 250);
  },

  formatDate(dateStr) {
    if (!dateStr) return 'Recent';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }
};

window.App = App;
