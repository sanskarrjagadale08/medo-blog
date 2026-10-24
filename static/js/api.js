/**
 * Medo Unified API Client
 * Manages HTTP requests, authentication tokens, study notes, blog posts, and toast notifications.
 */

const API = {
  baseUrl: '',

  getToken() {
    return localStorage.getItem('medo_token') || localStorage.getItem('mdei_token') || '';
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('medo_token', token);
      document.cookie = `medo_session=${token}; path=/; max-age=${30 * 24 * 3600}; SameSite=Lax`;
    } else {
      localStorage.removeItem('medo_token');
      localStorage.removeItem('mdei_token');
      document.cookie = `medo_session=; path=/; max-age=0`;
      document.cookie = `mdei_session=; path=/; max-age=0`;
    }
  },

  getStoredUser() {
    try {
      const u = localStorage.getItem('medo_user') || localStorage.getItem('mdei_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  setStoredUser(user) {
    if (user) {
      localStorage.setItem('medo_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('medo_user');
      localStorage.removeItem('mdei_user');
    }
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, {
        ...options,
        headers
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  // Auth Endpoints
  async login(usernameOrEmail, password) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: usernameOrEmail,
        username: usernameOrEmail,
        password
      })
    });
    if (res.token) {
      this.setToken(res.token);
      this.setStoredUser(res.user);
    }
    return res;
  },

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore network fail on logout
    }
    this.setToken(null);
    this.setStoredUser(null);
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  async updateProfile(profileData) {
    const res = await this.request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
    if (res.user) {
      this.setStoredUser(res.user);
    }
    return res;
  },

  // Public Posts & Reading (Medical Blogs)
  async getPosts({ page = 1, limit = 9, search = '', category = '', tag = '', featured = '' } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (tag) params.append('tag', tag);
    if (featured) params.append('featured', featured);
    return this.request(`/api/posts?${params.toString()}`);
  },

  async getFeaturedPosts() {
    return this.request('/api/featured');
  },

  async getPost(slugOrId) {
    return this.request(`/api/posts/${encodeURIComponent(slugOrId)}`);
  },

  async likePost(postId) {
    return this.request(`/api/posts/${postId}/like`, { method: 'POST' });
  },

  async addComment(postId, { name, email, content }) {
    return this.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ name, email, content })
    });
  },

  // Public MBBS Study Notes
  async getNotes({ page = 1, limit = 12, search = '', subject = '', prof_year = '', high_yield = '' } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (search) params.append('search', search);
    if (subject) params.append('subject', subject);
    if (prof_year) params.append('prof_year', prof_year);
    if (high_yield) params.append('high_yield', high_yield);
    return this.request(`/api/notes?${params.toString()}`);
  },

  async getNote(slugOrId) {
    return this.request(`/api/notes/${encodeURIComponent(slugOrId)}`);
  },

  async incrementNoteDownload(noteId) {
    return this.request(`/api/notes/${noteId}/download`, { method: 'POST' });
  },

  async getNoteSubjects() {
    return this.request('/api/notes/subjects');
  },

  // Taxonomies & General Data
  async getCategories() {
    return this.request('/api/categories');
  },

  async getTags() {
    return this.request('/api/tags');
  },

  async getAuthors() {
    return this.request('/api/authors');
  },

  async subscribeNewsletter(email) {
    return this.request('/api/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async sendContactMessage(formData) {
    return this.request('/api/contact', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
  },

  // Admin Endpoints
  async getAdminStats() {
    return this.request('/api/admin/stats');
  },

  // Admin Blogs
  async getAdminPosts({ status = 'all', search = '' } = {}) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    return this.request(`/api/admin/posts?${params.toString()}`);
  },

  async createPost(postData) {
    return this.request('/api/admin/posts', {
      method: 'POST',
      body: JSON.stringify(postData)
    });
  },

  async updatePost(postId, postData) {
    return this.request(`/api/admin/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify(postData)
    });
  },

  async deletePost(postId) {
    return this.request(`/api/admin/posts/${postId}`, {
      method: 'DELETE'
    });
  },

  async duplicatePost(postId) {
    return this.request(`/api/admin/posts/${postId}/duplicate`, {
      method: 'POST'
    });
  },

  // Admin Study Notes
  async getAdminNotes({ search = '', subject = '', prof_year = '', status = 'all' } = {}) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    if (subject) params.append('subject', subject);
    if (prof_year) params.append('prof_year', prof_year);
    return this.request(`/api/admin/notes?${params.toString()}`);
  },

  async createNote(noteData) {
    return this.request('/api/admin/notes', {
      method: 'POST',
      body: JSON.stringify(noteData)
    });
  },

  async updateNote(noteId, noteData) {
    return this.request(`/api/admin/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(noteData)
    });
  },

  async deleteNote(noteId) {
    return this.request(`/api/admin/notes/${noteId}`, {
      method: 'DELETE'
    });
  },

  // Categories & Tags
  async createCategory(catData) {
    return this.request('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify(catData)
    });
  },

  async updateCategory(catId, catData) {
    return this.request(`/api/admin/categories/${catId}`, {
      method: 'PUT',
      body: JSON.stringify(catData)
    });
  },

  async deleteCategory(catId) {
    return this.request(`/api/admin/categories/${catId}`, {
      method: 'DELETE'
    });
  },

  async createTag(tagData) {
    return this.request('/api/admin/tags', {
      method: 'POST',
      body: JSON.stringify(tagData)
    });
  },

  async deleteTag(tagId) {
    return this.request(`/api/admin/tags/${tagId}`, {
      method: 'DELETE'
    });
  },

  // Media Library
  async getMediaList() {
    return this.request('/api/admin/media');
  },

  async uploadMedia(mediaData) {
    return this.request('/api/admin/upload', {
      method: 'POST',
      body: JSON.stringify(mediaData)
    });
  },

  async deleteMedia(mediaId) {
    return this.request(`/api/admin/media/${mediaId}`, {
      method: 'DELETE'
    });
  },

  // Comments & Messages
  async getAdminComments() {
    return this.request('/api/admin/comments');
  },

  async toggleCommentStatus(commentId, isApproved) {
    return this.request(`/api/admin/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ is_approved: isApproved })
    });
  },

  async deleteComment(commentId) {
    return this.request(`/api/admin/comments/${commentId}`, {
      method: 'DELETE'
    });
  },

  async getAdminMessages() {
    return this.request('/api/admin/messages');
  },

  async markMessageRead(msgId) {
    return this.request(`/api/admin/messages/${msgId}/read`, {
      method: 'PUT'
    });
  },

  async deleteMessage(msgId) {
    return this.request(`/api/admin/messages/${msgId}`, {
      method: 'DELETE'
    });
  }
};

// Global Toast System
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClass = type === 'error' 
    ? 'bg-rose-600 text-white' 
    : type === 'info' 
    ? 'bg-slate-800 text-white' 
    : 'bg-emerald-600 text-white';

  const iconName = type === 'error' ? 'alert-circle' : type === 'info' ? 'info' : 'check-circle';

  toast.className = `toast flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium ${bgClass}`;
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-5 h-5 flex-shrink-0"></i>
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" class="ml-auto opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
