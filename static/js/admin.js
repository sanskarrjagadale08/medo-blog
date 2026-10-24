/**
 * Medo — The MBBS Student Admin CMS Application
 * Manages medical blogs, study notes, curriculum subjects, media, and security settings.
 */

const AdminApp = {
  state: {
    currentTab: 'dashboard',
    editingPostId: null,
    editingNoteId: null,
    postsFilter: 'all',
    postsSearch: '',
    notesFilter: 'all',
    notesSearch: '',
    notesSubjectFilter: '',
    notesProfYearFilter: '',
    categories: [],
    tags: [],
    authors: [],
    editorTags: [],
    editorPreviewMode: false,
    noteEditorPreviewMode: false
  },

  handleRoute(path) {
    const token = API.getToken();
    const sidebar = document.querySelector('#admin-container aside');
    const logoutBtn = document.querySelector('#admin-container header button[onclick*="handleLogout"]');

    document.getElementById('public-container').classList.add('hidden');
    document.getElementById('admin-container').classList.remove('hidden');

    if (!token || path === '/admin/login') {
      if (sidebar) sidebar.classList.add('hidden');
      if (logoutBtn) logoutBtn.classList.add('hidden');
      this.renderLogin();
      return;
    }

    if (sidebar) sidebar.classList.remove('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');

    // Route dispatch
    if (path === '/admin/posts/new') {
      this.openEditor(null);
    } else if (path.startsWith('/admin/posts/edit/')) {
      const id = parseInt(path.split('/admin/posts/edit/')[1]);
      this.openEditor(id);
    } else if (path === '/admin/posts') {
      this.setTab('posts');
    } else if (path === '/admin/notes/new') {
      this.openNoteEditor(null);
    } else if (path.startsWith('/admin/notes/edit/')) {
      const id = parseInt(path.split('/admin/notes/edit/')[1]);
      this.openNoteEditor(id);
    } else if (path === '/admin/notes') {
      this.setTab('notes');
    } else if (path === '/admin/categories') {
      this.setTab('categories');
    } else if (path === '/admin/media') {
      this.setTab('media');
    } else if (path === '/admin/comments') {
      this.setTab('comments');
    } else if (path === '/admin/messages') {
      this.setTab('messages');
    } else if (path === '/admin/settings') {
      this.setTab('settings');
    } else {
      this.setTab('dashboard');
    }
  },

  setTab(tab) {
    this.state.currentTab = tab;
    this.updateAdminSidebar();

    if (tab === 'dashboard') {
      this.renderDashboard();
    } else if (tab === 'posts') {
      this.renderPostsList();
    } else if (tab === 'editor') {
      this.renderEditor();
    } else if (tab === 'notes') {
      this.renderNotesList();
    } else if (tab === 'note-editor') {
      this.renderNoteEditor();
    } else if (tab === 'categories') {
      this.renderCategoriesManager();
    } else if (tab === 'media') {
      this.renderMediaLibrary();
    } else if (tab === 'comments') {
      this.renderCommentsModeration();
    } else if (tab === 'messages') {
      this.renderMessagesInbox();
    } else if (tab === 'settings') {
      this.renderSettings();
    }
  },

  updateAdminSidebar() {
    document.querySelectorAll('.admin-nav-item').forEach(el => {
      const tab = el.getAttribute('data-tab');
      if (tab === this.state.currentTab) {
        el.className = 'admin-nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-sm bg-teal-600 text-white shadow-md shadow-teal-600/20';
      } else {
        el.className = 'admin-nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition';
      }
    });
  },

  // ==========================================
  // 1. ADMIN LOGIN VIEW (CLEAN & SECURE)
  // ==========================================
  renderLogin() {
    const adminMain = document.getElementById('admin-content');
    adminMain.innerHTML = `
      <div class="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div class="max-w-md w-full p-8 sm:p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xl animate-fade-in">
          <div class="text-center mb-8">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-teal-500/30">
              <i data-lucide="shield-check" class="w-7 h-7 text-white"></i>
            </div>
            <h2 class="text-2xl font-extrabold text-slate-900 dark:text-white">Medo Admin Portal</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Sign in with your verified administrative credentials</p>
          </div>

          <form onsubmit="AdminApp.handleLogin(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Username or Email</label>
              <input
                type="text"
                id="login-email"
                required
                autocomplete="username"
                placeholder="Enter username (e.g. anuja2007) or email"
                class="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
              >
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
              </div>
              <div class="relative">
                <input
                  type="password"
                  id="login-password"
                  required
                  autocomplete="current-password"
                  placeholder="Enter your password"
                  class="w-full pl-4 pr-11 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
                >
                <button
                  type="button"
                  onclick="AdminApp.togglePasswordVisibility()"
                  class="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Toggle password view"
                >
                  <i data-lucide="eye" id="password-toggle-icon" class="w-4 h-4"></i>
                </button>
              </div>
            </div>

            <div id="login-error-msg" class="hidden text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 dark:border-rose-900"></div>

            <button
              type="submit"
              id="login-submit-btn"
              class="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2"
            >
              <i data-lucide="lock" class="w-4 h-4"></i>
              <span>Sign In to Medo CMS</span>
            </button>
          </form>

          <div class="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <a href="/" class="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1.5">
              <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Back to Medo Public Site
            </a>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  },

  togglePasswordVisibility() {
    const input = document.getElementById('login-password');
    const icon = document.getElementById('password-toggle-icon');
    if (!input || !icon) return;
    if (input.type === 'password') {
      input.type = 'text';
      icon.setAttribute('data-lucide', 'eye-off');
    } else {
      input.type = 'password';
      icon.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) lucide.createIcons();
  },

  async handleLogin(e) {
    e.preventDefault();
    const loginInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    const errBox = document.getElementById('login-error-msg');
    const submitBtn = document.getElementById('login-submit-btn');

    const usernameOrEmail = loginInput.value.trim();
    const password = passInput.value;

    if (!usernameOrEmail || !password) return;

    if (errBox) errBox.classList.add('hidden');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-75');
    }

    try {
      const res = await API.login(usernameOrEmail, password);
      showToast(res.message || "Logged in successfully!", "success");
      App.checkAdminStatus();
      this.handleRoute('/admin');
    } catch (err) {
      if (errBox) {
        errBox.innerText = err.message || "Authentication failed. Please verify credentials.";
        errBox.classList.remove('hidden');
      }
      showToast(err.message || "Invalid credentials", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-75');
      }
    }
  },

  async handleLogout() {
    await API.logout();
    App.checkAdminStatus();
    showToast("Logged out successfully", "info");
    this.handleRoute('/admin/login');
  },

  // ==========================================
  // 2. ADMIN DASHBOARD OVERVIEW
  // ==========================================
  async renderDashboard() {
    const adminMain = document.getElementById('admin-content');
    adminMain.innerHTML = `
      <div class="flex justify-center items-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    `;

    try {
      const res = await API.getAdminStats();
      const stats = res.stats || {};
      const recentPosts = res.recent_posts || [];
      const recentNotes = res.recent_notes || [];

      adminMain.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
          <!-- Top Greeting & Quick Actions -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Medo CMS Dashboard</h1>
              <p class="text-xs sm:text-sm text-slate-500">Welcome, Dr. Anuja • Overview of medical notes, blogs, and student reach</p>
            </div>
            <div class="flex items-center gap-3">
              <button onclick="AdminApp.openNoteEditor(null)" class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs sm:text-sm transition shadow-md shadow-teal-600/20">
                <i data-lucide="plus-circle" class="w-4 h-4"></i> Post Study Note
              </button>
              <button onclick="AdminApp.openEditor(null)" class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 font-semibold text-xs sm:text-sm transition shadow-sm">
                <i data-lucide="edit-3" class="w-4 h-4"></i> Post Medical Blog
              </button>
            </div>
          </div>

          <!-- Stats Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
              <div class="flex items-center justify-between text-teal-600 mb-2">
                <span class="text-xs font-semibold text-slate-500">Study Notes</span>
                <i data-lucide="book-open" class="w-4 h-4"></i>
              </div>
              <div class="text-2xl font-extrabold text-slate-900 dark:text-white">${stats.total_notes || 0}</div>
              <div class="text-[10px] text-teal-600 font-medium mt-1">${stats.published_notes || 0} published</div>
            </div>

            <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
              <div class="flex items-center justify-between text-cyan-600 mb-2">
                <span class="text-xs font-semibold text-slate-500">Medical Blogs</span>
                <i data-lucide="file-text" class="w-4 h-4"></i>
              </div>
              <div class="text-2xl font-extrabold text-slate-900 dark:text-white">${stats.total_posts || 0}</div>
              <div class="text-[10px] text-cyan-600 font-medium mt-1">${stats.published_posts || 0} published</div>
            </div>

            <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
              <div class="flex items-center justify-between text-emerald-600 mb-2">
                <span class="text-xs font-semibold text-slate-500">Total Views</span>
                <i data-lucide="eye" class="w-4 h-4"></i>
              </div>
              <div class="text-2xl font-extrabold text-slate-900 dark:text-white">${(stats.total_views || 0).toLocaleString()}</div>
              <div class="text-[10px] text-emerald-600 font-medium mt-1">Reader Impressions</div>
            </div>

            <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
              <div class="flex items-center justify-between text-rose-600 mb-2">
                <span class="text-xs font-semibold text-slate-500">Total Likes</span>
                <i data-lucide="heart" class="w-4 h-4"></i>
              </div>
              <div class="text-2xl font-extrabold text-slate-900 dark:text-white">${(stats.total_likes || 0).toLocaleString()}</div>
              <div class="text-[10px] text-rose-600 font-medium mt-1">Student Reactions</div>
            </div>

            <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
              <div class="flex items-center justify-between text-amber-600 mb-2">
                <span class="text-xs font-semibold text-slate-500">Note Downloads</span>
                <i data-lucide="download" class="w-4 h-4"></i>
              </div>
              <div class="text-2xl font-extrabold text-slate-900 dark:text-white">${(stats.total_note_downloads || 0).toLocaleString()}</div>
              <div class="text-[10px] text-amber-600 font-medium mt-1">Resource Saves</div>
            </div>

            <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
              <div class="flex items-center justify-between text-indigo-600 mb-2">
                <span class="text-xs font-semibold text-slate-500">Subscribers</span>
                <i data-lucide="users" class="w-4 h-4"></i>
              </div>
              <div class="text-2xl font-extrabold text-slate-900 dark:text-white">${stats.total_subscribers || 0}</div>
              <div class="text-[10px] text-indigo-600 font-medium mt-1">Weekly Readers</div>
            </div>
          </div>

          <!-- Two Column Activity Tables -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <!-- Recent Study Notes -->
            <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">
                  <i data-lucide="book-open" class="w-5 h-5 text-teal-600"></i>
                  <h3 class="font-extrabold text-base text-slate-900 dark:text-white">Recent Study Notes</h3>
                </div>
                <button onclick="AdminApp.setTab('notes')" class="text-xs font-semibold text-teal-600 hover:underline">
                  View All (${stats.total_notes || 0})
                </button>
              </div>

              <div class="space-y-3">
                ${recentNotes.length === 0 ? `
                  <div class="py-8 text-center text-xs text-slate-400">No notes posted yet.</div>
                ` : recentNotes.map(n => `
                  <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 transition">
                    <div class="min-w-0 pr-3">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">${n.subject}</span>
                        <span class="text-[10px] text-slate-400 font-medium">${n.prof_year}</span>
                      </div>
                      <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate">${n.title}</h4>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <button onclick="AdminApp.openNoteEditor(${n.id})" class="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50" title="Edit Note">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                      </button>
                      <a href="/notes/${n.slug}" target="_blank" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600" title="View Public">
                        <i data-lucide="external-link" class="w-4 h-4"></i>
                      </a>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Recent Medical Blogs -->
            <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">
                  <i data-lucide="file-text" class="w-5 h-5 text-cyan-600"></i>
                  <h3 class="font-extrabold text-base text-slate-900 dark:text-white">Recent Medical Blogs</h3>
                </div>
                <button onclick="AdminApp.setTab('posts')" class="text-xs font-semibold text-teal-600 hover:underline">
                  View All (${stats.total_posts || 0})
                </button>
              </div>

              <div class="space-y-3">
                ${recentPosts.length === 0 ? `
                  <div class="py-8 text-center text-xs text-slate-400">No blog posts yet.</div>
                ` : recentPosts.map(p => `
                  <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 transition">
                    <div class="min-w-0 pr-3">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-[10px] font-bold text-cyan-600">${p.category_name || 'MBBS'}</span>
                        <span class="text-[10px] text-slate-400">• ${p.views || 0} views</span>
                      </div>
                      <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate">${p.title}</h4>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <button onclick="AdminApp.openEditor(${p.id})" class="p-1.5 rounded-lg text-cyan-600 hover:bg-cyan-50" title="Edit Blog">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                      </button>
                      <a href="/posts/${p.slug}" target="_blank" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600" title="View Public">
                        <i data-lucide="external-link" class="w-4 h-4"></i>
                      </a>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      if (err.message && err.message.includes('401')) {
        this.renderLogin();
      } else {
        adminMain.innerHTML = `<div class="p-8 text-center text-rose-500">${err.message}</div>`;
      }
    }
  },

  // ==========================================
  // 3. STUDY NOTES MANAGEMENT LIST
  // ==========================================
  async renderNotesList() {
    const adminMain = document.getElementById('admin-content');
    adminMain.innerHTML = `
      <div class="flex justify-center items-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    `;

    try {
      const res = await API.getAdminNotes({
        status: this.state.notesFilter,
        search: this.state.notesSearch,
        subject: this.state.notesSubjectFilter,
        prof_year: this.state.notesProfYearFilter
      });
      const notes = res.notes || [];

      adminMain.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">All Study Notes</h1>
              <p class="text-xs sm:text-sm text-slate-500">Post and curate high-yield medical notes, cheat sheets, and OSCE pearls</p>
            </div>
            <button onclick="AdminApp.openNoteEditor(null)" class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs sm:text-sm transition shadow-md shadow-teal-600/20">
              <i data-lucide="plus-circle" class="w-4 h-4"></i> Post New Note
            </button>
          </div>

          <!-- Filters Bar -->
          <div class="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm mb-6">
            <div class="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              ${['all', 'published', 'draft'].map(st => `
                <button onclick="AdminApp.state.notesFilter = '${st}'; AdminApp.renderNotesList();" class="px-4 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${this.state.notesFilter === st ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}">
                  ${st}
                </button>
              `).join('')}
            </div>
            <div class="w-full sm:w-72">
              <input
                type="text"
                placeholder="Search notes by title or topic..."
                value="${this.state.notesSearch}"
                oninput="AdminApp.state.notesSearch = this.value; AdminApp.renderNotesList();"
                class="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
              >
            </div>
          </div>

          <!-- Notes Table -->
          <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th class="p-4">Subject & Prof</th>
                    <th class="p-4">Title & Topic</th>
                    <th class="p-4">High Yield</th>
                    <th class="p-4">Status</th>
                    <th class="p-4">Views / DL</th>
                    <th class="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  ${notes.length === 0 ? `
                    <tr>
                      <td colspan="6" class="py-12 text-center text-slate-400">No study notes found. Create your first note above!</td>
                    </tr>
                  ` : notes.map(n => `
                    <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      <td class="p-4 whitespace-nowrap">
                        <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800 block w-max">
                          ${n.subject}
                        </span>
                        <span class="text-[10px] text-slate-400 font-medium block mt-1">${n.prof_year}</span>
                      </td>
                      <td class="p-4 max-w-sm">
                        <div class="font-bold text-slate-900 dark:text-white line-clamp-1">${n.title}</div>
                        <div class="text-xs text-slate-400 truncate">${n.topic || n.summary || ''}</div>
                      </td>
                      <td class="p-4">
                        ${n.is_high_yield ? `
                          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">
                            <i data-lucide="zap" class="w-3 h-3 fill-current text-amber-500"></i> High Yield
                          </span>
                        ` : '<span class="text-xs text-slate-400">Standard</span>'}
                      </td>
                      <td class="p-4">
                        <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${n.status === 'published' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}">
                          ${n.status}
                        </span>
                      </td>
                      <td class="p-4 text-xs text-slate-500 whitespace-nowrap">
                        <div><i data-lucide="eye" class="w-3 h-3 inline"></i> ${n.views || 0} views</div>
                        <div><i data-lucide="download" class="w-3 h-3 inline"></i> ${n.downloads_count || 0} dl</div>
                      </td>
                      <td class="p-4 text-right whitespace-nowrap">
                        <div class="flex items-center justify-end gap-2">
                          <button onclick="AdminApp.openNoteEditor(${n.id})" class="p-2 rounded-xl hover:bg-teal-50 text-teal-600" title="Edit Note">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                          </button>
                          <a href="/notes/${n.slug}" target="_blank" class="p-2 rounded-xl hover:bg-slate-100 text-slate-500" title="View Public Note">
                            <i data-lucide="external-link" class="w-4 h-4"></i>
                          </a>
                          <button onclick="AdminApp.handleDeleteNote(${n.id}, decodeURIComponent('${encodeURIComponent(n.title)}'))" class="p-2 rounded-xl hover:bg-rose-50 text-rose-500" title="Delete Note">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      adminMain.innerHTML = `<div class="p-8 text-center text-rose-500">${err.message}</div>`;
    }
  },

  // ==========================================
  // 4. STUDY NOTE EDITOR VIEW
  // ==========================================
  async openNoteEditor(noteId = null) {
    this.state.editingNoteId = noteId;
    this.setTab('note-editor');
  },

  async renderNoteEditor() {
    const adminMain = document.getElementById('admin-content');
    adminMain.innerHTML = `
      <div class="flex justify-center items-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    `;

    try {
      let note = {
        title: '',
        slug: '',
        subject: 'Anatomy',
        prof_year: '1st Prof',
        topic: '',
        summary: '',
        content: '',
        download_url: '',
        is_high_yield: 1,
        status: 'published'
      };

      if (this.state.editingNoteId) {
        const res = await API.getNote(this.state.editingNoteId);
        if (res.note) {
          note = res.note;
        }
      }

      const subjects = [
        "Anatomy", "Physiology", "Biochemistry", "Pharmacology",
        "Pathology", "Microbiology", "Forensic Medicine", "Community Medicine (PSM)",
        "Ophthalmology", "ENT", "General Medicine", "General Surgery",
        "Obstetrics & Gynecology", "Pediatrics", "Orthopedics", "Dermatology", "Psychiatry"
      ];

      const profYears = ["1st Prof", "2nd Prof", "3rd Prof", "Final Prof"];

      adminMain.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
          <!-- Top Bar -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div class="flex items-center gap-3">
              <button onclick="AdminApp.setTab('notes')" class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition">
                <i data-lucide="arrow-left" class="w-4 h-4"></i>
              </button>
              <div>
                <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white">
                  ${this.state.editingNoteId ? 'Edit Study Note' : 'Post New Study Note'}
                </h1>
                <p class="text-xs text-slate-500">${this.state.editingNoteId ? `Editing ID #${this.state.editingNoteId}` : 'Create a high-yield medical study note'}</p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <button onclick="AdminApp.setTab('notes')" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">
                Cancel
              </button>
              <button onclick="document.getElementById('note-form').requestSubmit()" class="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-teal-600/25 flex items-center gap-2">
                <i data-lucide="check" class="w-4 h-4"></i> Save Study Note
              </button>
            </div>
          </div>

          <!-- Note Form -->
          <form id="note-form" onsubmit="AdminApp.handleSaveNote(event)" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Left / Main: Title, Summary, Content Editor -->
            <div class="lg:col-span-2 space-y-6">
              <!-- Title -->
              <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Note Title *</label>
                  <input
                    type="text"
                    id="note-title"
                    required
                    placeholder="e.g. Brachial Plexus Decoded: Roots, Cords & Clinical Lesions"
                    value="${note.title || ''}"
                    class="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base font-bold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
                  >
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-semibold text-slate-500 mb-1">URL Slug (Auto-generated if empty)</label>
                    <input
                      type="text"
                      id="note-slug"
                      placeholder="brachial-plexus-anatomy"
                      value="${note.slug || ''}"
                      class="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    >
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-500 mb-1">Topic / Sub-Specialty</label>
                    <input
                      type="text"
                      id="note-topic"
                      placeholder="e.g. Upper Limb & Neuroanatomy"
                      value="${note.topic || ''}"
                      class="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                    >
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-teal-600 mb-1">High-Yield Summary & Quick Revision Takeaways *</label>
                  <textarea
                    id="note-summary"
                    required
                    rows="3"
                    placeholder="Bullet points summarizing the core high-yield exam points, clinical signs, and mnemonics..."
                    class="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >${note.summary || ''}</textarea>
                </div>
              </div>

              <!-- Full Markdown Editor -->
              <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Note Content (Markdown supported)</span>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onclick="AdminApp.toggleNotePreview(false)"
                      id="note-write-tab"
                      class="px-3 py-1 text-xs font-bold rounded-lg bg-teal-600 text-white"
                    >
                      Write
                    </button>
                    <button
                      type="button"
                      onclick="AdminApp.toggleNotePreview(true)"
                      id="note-preview-tab"
                      class="px-3 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      Live Preview
                    </button>
                  </div>
                </div>

                <div id="note-write-container">
                  <textarea
                    id="note-content"
                    required
                    rows="18"
                    placeholder="Write your comprehensive medical notes in markdown with tables, headers, and mnemonics..."
                    class="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
                  >${note.content || ''}</textarea>
                </div>

                <div id="note-preview-container" class="hidden p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 min-h-[350px] prose-medo overflow-y-auto"></div>
              </div>
            </div>

            <!-- Right Sidebar: Settings & Taxonomy -->
            <div class="space-y-6">
              <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <h3 class="font-bold text-sm text-slate-900 dark:text-white">Curriculum Settings</h3>

                <div>
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Medical Subject *</label>
                  <select id="note-subject" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
                    ${subjects.map(s => `<option value="${s}" ${note.subject === s ? 'selected' : ''}>${s}</option>`).join('')}
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Prof Year *</label>
                  <select id="note-prof-year" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
                    ${profYears.map(y => `<option value="${y}" ${note.prof_year === y ? 'selected' : ''}>${y}</option>`).join('')}
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Publication Status</label>
                  <select id="note-status" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <option value="published" ${note.status === 'published' ? 'selected' : ''}>Published (Live for students)</option>
                    <option value="draft" ${note.status === 'draft' ? 'selected' : ''}>Draft (Hidden)</option>
                  </select>
                </div>

                <div class="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <label class="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" id="note-high-yield" ${note.is_high_yield ? 'checked' : ''} class="w-4 h-4 rounded text-amber-500 focus:ring-amber-400">
                    <span class="text-xs font-bold text-amber-600 dark:text-amber-400">⚡ Mark as High-Yield Pearl</span>
                  </label>
                  <p class="text-[11px] text-slate-400 mt-1 pl-7">Highlights this note with a special exam pearl badge and priority rank.</p>
                </div>

                <div class="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">PDF / Download URL</label>
                  <input
                    type="url"
                    id="note-download-url"
                    placeholder="https://drive.google.com/..."
                    value="${note.download_url || ''}"
                    class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                  <p class="text-[10px] text-slate-400 mt-1">Optional direct download link for PDF summary or cheat sheet.</p>
                </div>
              </div>
            </div>
          </form>
        </div>
      `;

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      adminMain.innerHTML = `<div class="p-8 text-center text-rose-500">${err.message}</div>`;
    }
  },

  toggleNotePreview(showPreview) {
    const writeCont = document.getElementById('note-write-container');
    const prevCont = document.getElementById('note-preview-container');
    const writeTab = document.getElementById('note-write-tab');
    const prevTab = document.getElementById('note-preview-tab');

    if (showPreview) {
      const content = document.getElementById('note-content').value;
      prevCont.innerHTML = App.parseMarkdown(content);
      writeCont.classList.add('hidden');
      prevCont.classList.remove('hidden');
      prevTab.className = 'px-3 py-1 text-xs font-bold rounded-lg bg-teal-600 text-white';
      writeTab.className = 'px-3 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
    } else {
      writeCont.classList.remove('hidden');
      prevCont.classList.add('hidden');
      writeTab.className = 'px-3 py-1 text-xs font-bold rounded-lg bg-teal-600 text-white';
      prevTab.className = 'px-3 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
    }
  },

  async handleSaveNote(e) {
    e.preventDefault();
    const title = document.getElementById('note-title').value.trim();
    const slug = document.getElementById('note-slug').value.trim();
    const topic = document.getElementById('note-topic').value.trim();
    const summary = document.getElementById('note-summary').value.trim();
    const content = document.getElementById('note-content').value.trim();
    const subject = document.getElementById('note-subject').value;
    const prof_year = document.getElementById('note-prof-year').value;
    const status = document.getElementById('note-status').value;
    const is_high_yield = document.getElementById('note-high-yield').checked ? 1 : 0;
    const download_url = document.getElementById('note-download-url').value.trim();

    if (!title || !content) {
      showToast("Title and content are required", "error");
      return;
    }

    const payload = {
      title,
      slug,
      topic,
      summary,
      content,
      subject,
      prof_year,
      status,
      is_high_yield,
      download_url
    };

    try {
      if (this.state.editingNoteId) {
        await API.updateNote(this.state.editingNoteId, payload);
        showToast("Study note updated successfully!", "success");
      } else {
        await API.createNote(payload);
        showToast("Study note published successfully!", "success");
      }
      this.state.editingNoteId = null;
      this.setTab('notes');
    } catch (err) {
      showToast(err.message || "Failed to save study note", "error");
    }
  },

  async handleDeleteNote(id, title) {
    if (!confirm(`Are you sure you want to permanently delete the note: "${title}"?`)) return;
    try {
      await API.deleteNote(id);
      showToast("Study note deleted", "info");
      this.renderNotesList();
    } catch (err) {
      showToast(err.message || "Failed to delete note", "error");
    }
  },

  // ==========================================
  // 5. MEDICAL POSTS (BLOGS) MANAGEMENT
  // ==========================================
  async renderPostsList() {
    const adminMain = document.getElementById('admin-content');
    adminMain.innerHTML = `
      <div class="flex justify-center items-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    `;

    try {
      const res = await API.getAdminPosts({ status: this.state.postsFilter, search: this.state.postsSearch });
      const posts = res.posts || [];

      adminMain.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Medical Blogs & Articles</h1>
              <p class="text-xs sm:text-sm text-slate-500">Manage published student guides, clinical reflections, and editorial essays</p>
            </div>
            <button onclick="AdminApp.openEditor(null)" class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs sm:text-sm transition shadow-md shadow-teal-600/20">
              <i data-lucide="plus" class="w-4 h-4"></i> Create New Blog
            </button>
          </div>

          <!-- Status Filters & Search Bar -->
          <div class="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm mb-6">
            <div class="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              ${['all', 'published', 'draft', 'scheduled'].map(st => `
                <button onclick="AdminApp.setPostsFilter('${st}')" class="px-4 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${this.state.postsFilter === st ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}">
                  ${st}
                </button>
              `).join('')}
            </div>
            <div class="w-full sm:w-72">
              <input type="text" placeholder="Search blog titles..." value="${this.state.postsSearch}" oninput="AdminApp.handlePostsSearch(this.value)" class="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500">
            </div>
          </div>

          <!-- Posts Table -->
          <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th class="p-4">Cover</th>
                    <th class="p-4">Title & Slug</th>
                    <th class="p-4">Subject Category</th>
                    <th class="p-4">Author</th>
                    <th class="p-4">Status</th>
                    <th class="p-4">Stats</th>
                    <th class="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  ${posts.length === 0 ? `
                    <tr>
                      <td colspan="7" class="py-12 text-center text-slate-400">No medical articles found matching filter.</td>
                    </tr>
                  ` : posts.map(p => `
                    <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      <td class="p-4 w-16">
                        <img src="${p.cover_image || 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=100'}" alt="" class="w-12 h-12 rounded-xl object-cover">
                      </td>
                      <td class="p-4 max-w-xs">
                        <div class="font-bold text-slate-900 dark:text-white truncate">${p.title}</div>
                        <div class="text-xs text-slate-400 font-mono truncate">/posts/${p.slug}</div>
                      </td>
                      <td class="p-4 text-xs font-medium">${p.category_name || '-'}</td>
                      <td class="p-4 text-xs text-slate-500">${p.author_name || 'Dr. Anuja'}</td>
                      <td class="p-4">
                        <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${p.status === 'published' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : p.status === 'scheduled' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}">
                          ${p.status}
                        </span>
                      </td>
                      <td class="p-4 text-xs text-slate-500 space-y-1">
                        <div><i data-lucide="eye" class="w-3 h-3 inline"></i> ${p.views || 0} views</div>
                        <div><i data-lucide="heart" class="w-3 h-3 inline"></i> ${p.likes_count || 0} likes</div>
                      </td>
                      <td class="p-4 text-right">
                        <div class="flex items-center justify-end gap-2">
                          <button onclick="AdminApp.openEditor(${p.id})" class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-teal-600" title="Edit">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                          </button>
                          <button onclick="AdminApp.handleDuplicatePost(${p.id})" class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600" title="Duplicate">
                            <i data-lucide="copy" class="w-4 h-4"></i>
                          </button>
                          <button onclick="AdminApp.handleDeletePost(${p.id}, decodeURIComponent('${encodeURIComponent(p.title)}'))" class="p-2 rounded-xl hover:bg-rose-50 hover:text-rose-600 text-slate-400" title="Delete">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      adminMain.innerHTML = `<div class="p-8 text-center text-rose-500">${err.message}</div>`;
    }
  },

  setPostsFilter(status) {
    this.state.postsFilter = status;
    this.renderPostsList();
  },

  handlePostsSearch(val) {
    this.state.postsSearch = val.trim();
    this.renderPostsList();
  },

  // ==========================================
  // 6. BLOG EDITOR (POSTS)
  // ==========================================
  async openEditor(postId = null) {
    this.state.editingPostId = postId;
    this.setTab('editor');
  },

  async renderEditor() {
    const adminMain = document.getElementById('admin-content');
    adminMain.innerHTML = `
      <div class="flex justify-center items-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    `;

    try {
      const [catRes, tagsRes, authorsRes] = await Promise.all([
        API.getCategories(),
        API.getTags(),
        API.getAuthors()
      ]);

      this.state.categories = catRes.categories || [];
      this.state.tags = tagsRes.tags || [];
      this.state.authors = authorsRes.authors || [];

      let post = {
        title: '',
        slug: '',
        excerpt: '',
        content: '',
        cover_image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1400&q=80',
        category_id: this.state.categories[0]?.id || 1,
        author_id: this.state.authors[0]?.id || 1,
        status: 'draft',
        is_featured: 0,
        meta_title: '',
        meta_description: '',
        meta_keywords: '',
        tags: []
      };

      if (this.state.editingPostId) {
        const pRes = await API.getPost(this.state.editingPostId);
        if (pRes.post) {
          post = pRes.post;
        }
      }

      this.state.editorTags = (post.tags || []).map(t => t.name);

      adminMain.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
          <!-- Top Editor Bar -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div class="flex items-center gap-3">
              <button onclick="AdminApp.setTab('posts')" class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition">
                <i data-lucide="arrow-left" class="w-4 h-4"></i>
              </button>
              <div>
                <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white">${this.state.editingPostId ? 'Edit Medical Blog' : 'Compose Medical Blog'}</h1>
                <p class="text-xs text-slate-500">${this.state.editingPostId ? `Editing ID: #${this.state.editingPostId}` : 'Publish an article, case report, or clinical pearl'}</p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <button onclick="AdminApp.setTab('posts')" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">
                Cancel
              </button>
              <button onclick="document.getElementById('post-form').requestSubmit()" class="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-teal-600/25 flex items-center gap-2">
                <i data-lucide="check" class="w-4 h-4"></i> Save Blog
              </button>
            </div>
          </div>

          <!-- Main Form -->
          <form id="post-form" onsubmit="AdminApp.handleSavePost(event)" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Left 2 Cols: Title, Excerpt, Content -->
            <div class="lg:col-span-2 space-y-6">
              <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Article Title *</label>
                  <input
                    type="text"
                    id="editor-title"
                    required
                    placeholder="e.g. Surviving 1st Year MBBS: Anatomy Dissection & Guyton Guide"
                    value="${post.title || ''}"
                    class="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base font-bold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
                  >
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-500 mb-1">Slug (Auto-generated if blank)</label>
                  <input
                    type="text"
                    id="editor-slug"
                    placeholder="surviving-1st-year-mbbs-anatomy-guide"
                    value="${post.slug || ''}"
                    class="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                  >
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-500 mb-1">Article Excerpt *</label>
                  <textarea
                    id="editor-excerpt"
                    required
                    rows="3"
                    placeholder="Short engaging overview for article cards and search results..."
                    class="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >${post.excerpt || ''}</textarea>
                </div>
              </div>

              <!-- Markdown Editor -->
              <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Article Content (Markdown)</span>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onclick="AdminApp.togglePostPreview(false)"
                      id="post-write-tab"
                      class="px-3 py-1 text-xs font-bold rounded-lg bg-teal-600 text-white"
                    >
                      Write
                    </button>
                    <button
                      type="button"
                      onclick="AdminApp.togglePostPreview(true)"
                      id="post-preview-tab"
                      class="px-3 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      Preview
                    </button>
                  </div>
                </div>

                <div id="post-write-container">
                  <textarea
                    id="editor-content"
                    required
                    rows="20"
                    placeholder="Compose clinical article in markdown..."
                    class="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
                  >${post.content || ''}</textarea>
                </div>

                <div id="post-preview-container" class="hidden p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 min-h-[400px] prose-medo overflow-y-auto"></div>
              </div>
            </div>

            <!-- Right Col: Meta & Organization -->
            <div class="space-y-6">
              <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <h3 class="font-bold text-sm text-slate-900 dark:text-white">Organization</h3>

                <div>
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Subject Category</label>
                  <select id="editor-category" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold">
                    ${this.state.categories.map(c => `
                      <option value="${c.id}" ${post.category_id === c.id ? 'selected' : ''}>${c.name}</option>
                    `).join('')}
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Author</label>
                  <select id="editor-author" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold">
                    ${this.state.authors.map(a => `
                      <option value="${a.id}" ${post.author_id === a.id ? 'selected' : ''}>${a.name}</option>
                    `).join('')}
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Publication Status</label>
                  <select id="editor-status" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold">
                    <option value="draft" ${post.status === 'draft' ? 'selected' : ''}>Draft</option>
                    <option value="published" ${post.status === 'published' ? 'selected' : ''}>Published</option>
                    <option value="scheduled" ${post.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                  </select>
                </div>

                <div>
                  <label class="flex items-center gap-2 cursor-pointer pt-2">
                    <input type="checkbox" id="editor-featured" ${post.is_featured ? 'checked' : ''} class="w-4 h-4 rounded text-teal-600">
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-300">Feature on Homepage</span>
                  </label>
                </div>

                <div class="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Cover Image URL</label>
                  <input
                    type="url"
                    id="editor-cover"
                    value="${post.cover_image || ''}"
                    class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                </div>
              </div>
            </div>
          </form>
        </div>
      `;

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      adminMain.innerHTML = `<div class="p-8 text-center text-rose-500">${err.message}</div>`;
    }
  },

  togglePostPreview(showPreview) {
    const writeCont = document.getElementById('post-write-container');
    const prevCont = document.getElementById('post-preview-container');
    const writeTab = document.getElementById('post-write-tab');
    const prevTab = document.getElementById('post-preview-tab');

    if (showPreview) {
      const content = document.getElementById('editor-content').value;
      prevCont.innerHTML = App.parseMarkdown(content);
      writeCont.classList.add('hidden');
      prevCont.classList.remove('hidden');
      prevTab.className = 'px-3 py-1 text-xs font-bold rounded-lg bg-teal-600 text-white';
      writeTab.className = 'px-3 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
    } else {
      writeCont.classList.remove('hidden');
      prevCont.classList.add('hidden');
      writeTab.className = 'px-3 py-1 text-xs font-bold rounded-lg bg-teal-600 text-white';
      prevTab.className = 'px-3 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
    }
  },

  async handleSavePost(e) {
    e.preventDefault();
    const title = document.getElementById('editor-title').value.trim();
    const slug = document.getElementById('editor-slug').value.trim();
    const excerpt = document.getElementById('editor-excerpt').value.trim();
    const content = document.getElementById('editor-content').value.trim();
    const category_id = parseInt(document.getElementById('editor-category').value);
    const author_id = parseInt(document.getElementById('editor-author').value);
    const status = document.getElementById('editor-status').value;
    const is_featured = document.getElementById('editor-featured').checked ? 1 : 0;
    const cover_image = document.getElementById('editor-cover').value.trim();

    if (!title || !content) {
      showToast("Title and content are required", "error");
      return;
    }

    const payload = {
      title,
      slug,
      excerpt,
      content,
      category_id,
      author_id,
      status,
      is_featured,
      cover_image
    };

    try {
      if (this.state.editingPostId) {
        await API.updatePost(this.state.editingPostId, payload);
        showToast("Article updated successfully!", "success");
      } else {
        await API.createPost(payload);
        showToast("Article published successfully!", "success");
      }
      this.state.editingPostId = null;
      this.setTab('posts');
    } catch (err) {
      showToast(err.message || "Failed to save article", "error");
    }
  },

  async handleDuplicatePost(id) {
    try {
      await API.duplicatePost(id);
      showToast("Post duplicated as draft", "success");
      this.renderPostsList();
    } catch (err) {
      showToast("Failed to duplicate", "error");
    }
  },

  async handleDeletePost(id, title) {
    if (!confirm(`Delete blog post: "${title}"?`)) return;
    try {
      await API.deletePost(id);
      showToast("Post deleted", "info");
      this.renderPostsList();
    } catch (err) {
      showToast("Failed to delete post", "error");
    }
  },

  // ==========================================
  // 7. CATEGORIES & TAXONOMIES
  // ==========================================
  async renderCategoriesManager() {
    const adminMain = document.getElementById('admin-content');
    adminMain.innerHTML = `
      <div class="flex justify-center items-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    `;

    try {
      const [catRes, tagsRes] = await Promise.all([
        API.getCategories(),
        API.getTags()
      ]);

      const categories = catRes.categories || [];
      const tags = tagsRes.tags || [];

      adminMain.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
          <div class="mb-8">
            <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Subjects & Tags Directory</h1>
            <p class="text-xs sm:text-sm text-slate-500">Manage MBBS subject curricula and searchable topic tags</p>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Categories -->
            <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
              <h3 class="font-extrabold text-base text-slate-900 dark:text-white">Medical Subjects (${categories.length})</h3>
              <div class="space-y-3">
                ${categories.map(c => `
                  <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-xl flex items-center justify-center text-white" style="background-color: ${c.color}">
                        <i data-lucide="${c.icon || 'activity'}" class="w-4 h-4"></i>
                      </div>
                      <div>
                        <h4 class="font-bold text-xs text-slate-900 dark:text-white">${c.name}</h4>
                        <span class="text-[10px] text-slate-400">${c.post_count || 0} articles</span>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Tags -->
            <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
              <h3 class="font-extrabold text-base text-slate-900 dark:text-white">Medical Tags (${tags.length})</h3>
              <div class="flex flex-wrap gap-2">
                ${tags.map(t => `
                  <span class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
                    #${t.name} <span class="opacity-60 text-[10px]">(${t.post_count || 0})</span>
                  </span>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      adminMain.innerHTML = `<div class="p-8 text-center text-rose-500">${err.message}</div>`;
    }
  },

  // ==========================================
  // 8. MEDIA LIBRARY
  // ==========================================
  async renderMediaLibrary() {
    const adminMain = document.getElementById('admin-content');
    adminMain.innerHTML = `
      <div class="flex justify-center items-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    `;

    try {
      const res = await API.getMediaList();
      const media = res.media || [];

      adminMain.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Media Library</h1>
              <p class="text-xs sm:text-sm text-slate-500">Medical illustrations, anatomical diagrams, and clinical charts</p>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            ${media.length === 0 ? `
              <div class="col-span-full py-12 text-center text-slate-400">No media assets found.</div>
            ` : media.map(m => `
              <div class="group rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-lg transition">
                <img src="${m.url}" alt="${m.alt_text || ''}" class="w-full aspect-[4/3] object-cover">
                <div class="p-4">
                  <div class="font-bold text-xs truncate">${m.original_name}</div>
                  <div class="text-[10px] text-slate-400 mt-0.5 truncate">${m.url}</div>
                  <button onclick="navigator.clipboard.writeText('${m.url}'); showToast('URL copied!', 'success');" class="mt-3 w-full py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold hover:bg-teal-50 hover:text-teal-600 transition">
                    Copy URL
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      adminMain.innerHTML = `<div class="p-8 text-center text-rose-500">${err.message}</div>`;
    }
  },

  // ==========================================
  // 9. COMMENTS MODERATION
  // ==========================================
  async renderCommentsModeration() {
    const adminMain = document.getElementById('admin-content');
    adminMain.innerHTML = `
      <div class="flex justify-center items-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    `;

    try {
      const res = await API.getAdminComments();
      const comments = res.comments || [];

      adminMain.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
          <div class="mb-8">
            <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Reader Discussions</h1>
            <p class="text-xs sm:text-sm text-slate-500">Moderate peer comments and discussions across medical blogs</p>
          </div>

          <div class="space-y-4">
            ${comments.length === 0 ? `
              <div class="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
                No reader comments yet.
              </div>
            ` : comments.map(c => `
              <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-sm">${c.author_name}</span>
                    <span class="text-xs text-slate-400">on "${c.post_title}"</span>
                  </div>
                  <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">${c.content}</p>
                </div>
                <div class="flex items-center gap-2 self-start sm:self-center">
                  <button onclick="AdminApp.handleDeleteComment(${c.id})" class="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition" title="Delete">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      adminMain.innerHTML = `<div class="p-8 text-center text-rose-500">${err.message}</div>`;
    }
  },

  async handleDeleteComment(id) {
    if (!confirm("Delete comment?")) return;
    try {
      await API.deleteComment(id);
      showToast("Comment deleted", "info");
      this.renderCommentsModeration();
    } catch (err) {
      showToast("Failed to delete", "error");
    }
  },

  // ==========================================
  // 10. STUDENT INQUIRIES
  // ==========================================
  async renderMessagesInbox() {
    const adminMain = document.getElementById('admin-content');
    adminMain.innerHTML = `
      <div class="flex justify-center items-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    `;

    try {
      const res = await API.getAdminMessages();
      const messages = res.messages || [];

      adminMain.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
          <div class="mb-8">
            <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Student Inquiries & Submissions</h1>
            <p class="text-xs sm:text-sm text-slate-500">Review case studies, questions, and note suggestions from readers</p>
          </div>

          <div class="space-y-4">
            ${messages.length === 0 ? `
              <div class="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
                Inbox is clean! No messages received yet.
              </div>
            ` : messages.map(m => `
              <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="font-bold text-sm">${m.subject}</h4>
                    <span class="text-xs text-slate-400">From ${m.name} (${m.email}) • Category: ${m.category}</span>
                  </div>
                  <button onclick="AdminApp.handleDeleteMessage(${m.id})" class="text-slate-400 hover:text-rose-500 p-2">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
                <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl">
                  ${m.message}
                </p>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      adminMain.innerHTML = `<div class="p-8 text-center text-rose-500">${err.message}</div>`;
    }
  },

  async handleDeleteMessage(id) {
    if (!confirm("Delete message?")) return;
    try {
      await API.deleteMessage(id);
      showToast("Message deleted", "info");
      this.renderMessagesInbox();
    } catch (err) {
      showToast("Failed to delete", "error");
    }
  },

  // ==========================================
  // 11. PROFILE & SECURITY SETTINGS
  // ==========================================
  async renderSettings() {
    const adminMain = document.getElementById('admin-content');
    adminMain.innerHTML = `
      <div class="flex justify-center items-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    `;

    try {
      const res = await API.getMe();
      const user = res.user || {};

      adminMain.innerHTML = `
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
          <div class="mb-8">
            <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Admin Profile & Security</h1>
            <p class="text-xs sm:text-sm text-slate-500">Manage credentials for Dr. Anuja and platform security</p>
          </div>

          <div class="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
            <form onsubmit="AdminApp.handleSaveProfile(event)" class="space-y-4">
              <div class="flex items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                <img src="${user.avatar || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200'}" alt="${user.name}" class="w-16 h-16 rounded-full object-cover ring-4 ring-teal-500/20">
                <div>
                  <h3 class="font-bold text-slate-900 dark:text-white text-base">${user.name}</h3>
                  <p class="text-xs text-slate-500 font-mono">Username: <strong class="text-teal-600">${user.username || 'anuja2007'}</strong> • Email: ${user.email}</p>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Display Name</label>
                  <input type="text" name="name" value="${user.name || ''}" class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Avatar Image URL</label>
                  <input type="text" name="avatar" value="${user.avatar || ''}" class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Author Bio</label>
                <textarea name="bio" rows="3" class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">${user.bio || ''}</textarea>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Twitter / X</label>
                  <input type="text" name="twitter" value="${user.twitter || ''}" placeholder="https://twitter.com/..." class="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">GitHub</label>
                  <input type="text" name="github" value="${user.github || ''}" placeholder="https://github.com/..." class="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">LinkedIn</label>
                  <input type="text" name="linkedin" value="${user.linkedin || ''}" placeholder="https://linkedin.com/in/..." class="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                </div>
              </div>

              <div class="pt-4 border-t border-slate-100 dark:border-slate-800">
                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Change Admin Password (Leave blank to keep current)</label>
                <input type="password" name="new_password" placeholder="Enter new password (optional)" class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
              </div>

              <button type="submit" class="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition shadow-md shadow-teal-600/20">
                Save Profile Changes
              </button>
            </form>
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      adminMain.innerHTML = `<div class="p-8 text-center text-rose-500">${err.message}</div>`;
    }
  },

  async handleSaveProfile(e) {
    e.preventDefault();
    const form = e.target;
    try {
      await API.updateProfile({
        name: form.name.value.trim(),
        avatar: form.avatar.value.trim(),
        bio: form.bio.value.trim(),
        twitter: form.twitter.value.trim(),
        github: form.github.value.trim(),
        linkedin: form.linkedin.value.trim(),
        new_password: form.new_password.value.trim()
      });
      showToast("Profile updated successfully!", "success");
      this.renderSettings();
    } catch (err) {
      showToast(err.message || "Failed to update profile", "error");
    }
  }
};

window.AdminApp = AdminApp;
