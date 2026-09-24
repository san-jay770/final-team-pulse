/**
 * TEAM PULSE — Unified Frontend API & UI Client
 */

const API = {
  baseUrl: '/api',

  // ── Network Wrapper ──────────────────────────────────────
  async request(endpoint, options = {}) {
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'same-origin',
    };

    const config = { ...defaultOptions, ...options };
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      config.body = JSON.stringify(options.body);
    }
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      const data = await response.json().catch(() => ({ success: false, message: 'Invalid response format' }));

      if (response.status === 401) {
        if (!window.location.pathname.endsWith('login.html') && window.location.pathname !== '/') {
          sessionStorage.setItem('tp_redirect_reason', 'Session expired. Please log in again.');
          window.location.href = '/login.html';
        }
        return { success: false, message: 'Unauthorized', status: 401 };
      }

      if (!response.ok) {
        return { success: false, message: data.message || `Request failed with status ${response.status}`, status: response.status, data };
      }

      return data;
    } catch (err) {
      console.error('[API Error]:', err);
      return { success: false, message: 'Network error or server unavailable.' };
    }
  },

  // ── Auth Methods ─────────────────────────────────────────
  async getMe() {
    return this.request('/auth/me');
  },

  async login(email, password, team_id = null, view_mode = null) {
    return this.request('/auth/login', {
      method: 'POST',
      body: { email, password, team_id, view_mode },
    });
  },

  async logout() {
    const res = await this.request('/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
    return res;
  },

  async switchTeam(team_id, view_mode = null) {
    UI.showToast('Switching workspace...', 'info');
    const res = await this.request('/auth/switch-team', {
      method: 'POST',
      body: { team_id, view_mode },
    });
    if (res.success && res.redirect) {
      UI.showToast(res.message || 'Workspace switched!', 'success');
      setTimeout(() => {
        window.location.href = res.redirect;
      }, 300);
    } else {
      UI.showToast(res.message || 'Failed to switch workspace', 'danger');
    }
    return res;
  },

  // ── Tasks Methods ────────────────────────────────────────
  async getTasks(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/tasks${q ? '?' + q : ''}`);
  },

  async getTask(id) {
    return this.request(`/tasks/${id}`);
  },

  async createTask(taskData) {
    return this.request('/tasks', { method: 'POST', body: taskData });
  },

  async updateTask(id, taskData) {
    return this.request(`/tasks/${id}`, { method: 'PUT', body: taskData });
  },

  async deleteTask(id) {
    return this.request(`/tasks/${id}`, { method: 'DELETE' });
  },

  // ── Users Methods ────────────────────────────────────────
  async getUsers(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/users${q ? '?' + q : ''}`);
  },

  async getUser(id) {
    return this.request(`/users/${id}`);
  },

  async createUser(userData) {
    return this.request('/users', { method: 'POST', body: userData });
  },

  async updateUser(id, userData) {
    return this.request(`/users/${id}`, { method: 'PUT', body: userData });
  },

  async deleteUser(id) {
    return this.request(`/users/${id}`, { method: 'DELETE' });
  },

  async resetPassword(id, new_password) {
    return this.request(`/users/${id}/reset-password`, { method: 'PUT', body: { new_password } });
  },

  async updateUserPhone(id, phone) {
    return this.request(`/users/${id}/phone`, { method: 'POST', body: { phone } });
  },

  async checkUserEmail(email) {
    return this.request(`/users/check-email?email=${encodeURIComponent(email)}`);
  },

  // ── Teams Methods ────────────────────────────────────────
  async getTeams() {
    return this.request('/teams');
  },

  async getTeam(id) {
    return this.request(`/teams/${id}`);
  },

  async createTeam(teamData) {
    return this.request('/teams', { method: 'POST', body: teamData });
  },

  async updateTeam(id, teamData) {
    return this.request(`/teams/${id}`, { method: 'PUT', body: teamData });
  },

  async deleteTeam(id) {
    return this.request(`/teams/${id}`, { method: 'DELETE' });
  },

  async getTeamMembers(teamId) {
    return this.request(`/teams/${teamId}/members`);
  },

  // ── Doubts Methods ───────────────────────────────────────
  async getDoubts(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/doubts${q ? '?' + q : ''}`);
  },

  async createDoubt(doubtData) {
    return this.request('/doubts', { method: 'POST', body: doubtData });
  },

  async updateDoubt(id, doubtData) {
    return this.request(`/doubts/${id}`, { method: 'PUT', body: doubtData });
  },

  async deleteDoubt(id) {
    return this.request(`/doubts/${id}`, { method: 'DELETE' });
  },

  // ── Suggestions Methods ──────────────────────────────────
  async getSuggestions(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/suggestions${q ? '?' + q : ''}`);
  },

  async createSuggestion(data) {
    return this.request('/suggestions', { method: 'POST', body: data });
  },

  async updateSuggestion(id, data) {
    return this.request(`/suggestions/${id}`, { method: 'PUT', body: data });
  },

  async deleteSuggestion(id) {
    return this.request(`/suggestions/${id}`, { method: 'DELETE' });
  },

  // ── Notifications Methods ────────────────────────────────
  async getNotifications() {
    return this.request('/notifications');
  },

  async markNotificationRead(id) {
    return this.request(`/notifications/${id}/read`, { method: 'PUT' });
  },

  async markAllNotificationsRead() {
    return this.request('/notifications/read-all', { method: 'PUT' });
  },

  // ── Admin / Stats Methods ────────────────────────────────
  async getAdminDashboard() {
    return this.request('/admin/dashboard');
  },

  async getEmailConfig() {
    return this.request('/admin/email-config');
  },

  async sendTestEmail(toEmail) {
    return this.request('/admin/test-email', { method: 'POST', body: { to: toEmail } });
  },

  async getLeaderboard() {
    return this.request('/admin/leaderboard');
  },

  async getActivities(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/activities${q ? '?' + q : ''}`);
  },

  async getReport(type, params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/reports/${type}${q ? '?' + q : ''}`);
  },

  async downloadFile(endpoint, defaultFilename = 'report.xlsx') {
    try {
      const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        let errText = 'Download failed';
        try {
          const json = await res.json();
          errText = json.message || errText;
        } catch (_) {}
        if (typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast(errText, 'danger');
        }
        return false;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      let filename = defaultFilename;
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast(`Downloaded ${filename}`, 'success');
      }
      return true;
    } catch (e) {
      console.error('Download error:', e);
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('Failed to download file', 'danger');
      }
      return false;
    }
  },

  async exportReport(type, params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.downloadFile(`/reports/export/${type}${q ? '?' + q : ''}`, `TeamPulse_${type}_Report.xlsx`);
  },

  async exportTasks(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.downloadFile(`/tasks/export/excel${q ? '?' + q : ''}`, `TeamPulse_Tasks.xlsx`);
  },
};

// ─────────────────────────────────────────────────────────────
// Shell Renderer & UI Controller
// ─────────────────────────────────────────────────────────────

const UI = {
  currentUser: null,
  userTeams: [],

  // Toast Notification
  showToast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('tp-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tp-toast-container';
      container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colors = {
      success: { bg: '#10B981', icon: '✓' },
      danger:  { bg: '#EF4444', icon: '✕' },
      warning: { bg: '#F59E0B', icon: '⚠' },
      info:    { bg: '#3B82F6', icon: 'ℹ' },
    };
    const c = colors[type] || colors.info;

    toast.style.cssText = `
      background: ${c.bg};
      color: #fff;
      padding: 12px 18px;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 10px;
      pointer-events: auto;
      animation: slideInRight 0.25s ease-out;
      min-width: 260px;
      max-width: 420px;
    `;
    toast.innerHTML = `<span style="font-weight:700;">${c.icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Initialize shell for any page
  async initShell(options = {}) {
    const { activeRoute = 'dashboard', allowedRoles = [], pageTitle = 'Team Pulse' } = options;

    const res = await API.getMe();
    if (!res.success || !res.user) {
      sessionStorage.setItem('tp_redirect_reason', 'Please log in to continue.');
      window.location.href = '/login.html';
      return null;
    }

    this.currentUser = res.user;
    this.userTeams   = res.teams || [];

    if (allowedRoles.length > 0 && !allowedRoles.includes(res.user.role)) {
      UI.showToast('Access denied: Unauthorized role.', 'danger');
      if (res.user.role === 'SUPER_ADMIN') window.location.href = '/dashboard_super.html';
      else if (res.user.role === 'ADMIN')  window.location.href = '/dashboard_admin.html';
      else window.location.href = '/dashboard_member.html';
      return null;
    }

    // Determine default dashboard href
    const dashHref = res.user.role === 'SUPER_ADMIN' ? '/dashboard_super.html'
      : res.user.role === 'ADMIN' ? '/dashboard_admin.html'
      : '/dashboard_member.html';

    const isSuper = res.user.role === 'SUPER_ADMIN';
    const isAdminOrSuper = ['SUPER_ADMIN', 'ADMIN'].includes(res.user.role);

    // Render universal layout structure if container exists
    const appContainer = document.getElementById('app');
    const contentSlot  = document.getElementById('pageContent');

    if (appContainer && !document.getElementById('sidebar')) {
      const pageInner = contentSlot ? contentSlot.innerHTML : '';

      appContainer.innerHTML = `
        <div class="app-layout">
            <div class="sidebar-overlay" id="sidebarOverlay"></div>

            <!-- Sidebar Navigation -->
            <aside class="sidebar" id="sidebar">
                <div class="sidebar-header">
                    <div class="sidebar-brand">
                        <div class="brand-icon">TP</div>
                        <span>TEAM PULSE</span>
                    </div>
                </div>

                <nav class="sidebar-nav">
                    <div class="nav-label">Main Menu</div>

                    ${isSuper ? `
                    <a href="/dashboard_super.html" class="nav-item ${activeRoute === 'dashboard_super' || window.location.pathname.includes('dashboard_super') ? 'active' : ''}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                        <span>👑 Super Admin Dashboard</span>
                    </a>
                    <a href="/dashboard_admin.html" class="nav-item ${activeRoute === 'dashboard_admin' || window.location.pathname.includes('dashboard_admin') ? 'active' : ''}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                        <span>🛡️ Team Admin View</span>
                    </a>
                    ` : `
                    <a href="${dashHref}" class="nav-item ${activeRoute === 'dashboard' ? 'active' : ''}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                        <span>Dashboard</span>
                    </a>
                    `}

                    ${isAdminOrSuper ? `
                    <a href="/users.html" class="nav-item ${activeRoute === 'users' ? 'active' : ''}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                        <span>Users</span>
                    </a>` : ''}

                    ${isSuper ? `
                    <a href="/teams.html" class="nav-item ${activeRoute === 'teams' ? 'active' : ''}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        <span>Teams</span>
                    </a>` : ''}

                    <a href="/tasks.html" class="nav-item ${activeRoute === 'tasks' ? 'active' : ''}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                        <span>Tasks</span>
                    </a>

                    <a href="/doubts.html" class="nav-item ${activeRoute === 'doubts' ? 'active' : ''}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span>Doubts</span>
                    </a>

                    <a href="/suggestions.html" class="nav-item ${activeRoute === 'suggestions' ? 'active' : ''}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                        <span>Suggestions</span>
                    </a>

                    <a href="/leaderboard.html" class="nav-item ${activeRoute === 'leaderboard' ? 'active' : ''}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                        <span>Leaderboard</span>
                    </a>

                    ${isSuper ? `
                    <div class="nav-label">Analytics & System</div>

                    <a href="/activities.html" class="nav-item ${activeRoute === 'activities' ? 'active' : ''}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span>Activities</span>
                    </a>

                    <a href="/reports.html" class="nav-item ${activeRoute === 'reports' ? 'active' : ''}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        <span>Reports</span>
                    </a>` : ''}

                    <div class="nav-label">Account</div>

                    <a href="/profile.html" class="nav-item ${activeRoute === 'profile' ? 'active' : ''}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        <span>Profile</span>
                    </a>
                </nav>

                <div class="sidebar-footer">
                    <div class="user-quick-profile">
                        <div class="avatar-circle">${this.currentUser.name ? this.currentUser.name.charAt(0).toUpperCase() : 'U'}</div>
                        <div class="user-quick-info">
                            <div class="user-name">${this.currentUser.name}</div>
                            <div class="user-role-badge">${this.currentUser.role.replace('_', ' ')}</div>
                            ${this.userTeams.length > 1 ? `<div style="font-size: 0.72rem; color: #94A3B8; margin-top: 2px;">${this.userTeams.length} Workspaces</div>` : ''}
                        </div>
                    </div>
                </div>
            </aside>

            <!-- Main Content Area -->
            <div class="main-wrapper">
                <header class="navbar-top">
                    <div class="navbar-left">
                        <button class="menu-toggle" id="menuToggle" aria-label="Toggle navigation">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                        </button>
                        <div class="page-title">${pageTitle}</div>
                    </div>

                    <div class="navbar-right">
                        ${isSuper ? `
                        <!-- Super Admin / Admin Page Dual Switcher -->
                        <div class="super-admin-view-toggle" style="display:inline-flex; align-items:center; background:#f5f3ff; border:1.5px solid #ddd6fe; border-radius:30px; padding:3px; gap:3px;">
                            <a href="/dashboard_super.html" title="Super Admin Dashboard" style="text-decoration:none; padding:5px 12px; border-radius:20px; font-size:0.78rem; font-weight:700; display:flex; align-items:center; gap:5px; transition:all 0.2s ease; ${window.location.pathname.includes('dashboard_super') ? 'background:#7c3aed; color:#ffffff; box-shadow:0 2px 6px rgba(124,58,237,0.35);' : 'color:#6d28d9;'}">
                                <span>👑</span>
                                <span>Super Admin</span>
                            </a>
                            <a href="/dashboard_admin.html" title="Team Admin Operations Dashboard" style="text-decoration:none; padding:5px 12px; border-radius:20px; font-size:0.78rem; font-weight:700; display:flex; align-items:center; gap:5px; transition:all 0.2s ease; ${window.location.pathname.includes('dashboard_admin') ? 'background:#7c3aed; color:#ffffff; box-shadow:0 2px 6px rgba(124,58,237,0.35);' : 'color:#6d28d9;'}">
                                <span>🛡️</span>
                                <span>Admin Page</span>
                            </a>
                        </div>
                        ` : ''}

                        ${this.userTeams.length > 1 ? `
                        <div class="team-switcher-dropdown" style="position: relative;">
                            <button type="button" class="team-switcher-btn" id="teamSwitcherBtn" title="Switch Workspace" style="display: flex; align-items: center; gap: 6px; background: rgba(37,99,235,0.1); color: var(--primary); border: 1px solid rgba(37,99,235,0.25); padding: 6px 10px; border-radius: var(--radius-md); font-size: 0.82rem; font-weight: 600; cursor: pointer; white-space: nowrap;">
                                <svg style="width:16px;height:16px;flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                                <span class="ws-label">Switch (${this.userTeams.length})</span>
                            </button>
                            <div class="team-switcher-menu" id="teamSwitcherMenu" style="display:none; position: absolute; right: 0; top: calc(100% + 6px); background: white; min-width: 220px; border-radius: var(--radius-md); box-shadow: var(--shadow-lg); border: 1px solid var(--border-color); z-index: 1000; padding: 6px 0; max-height: 70vh; overflow-y: auto;">
                                <div style="padding: 8px 14px; font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid var(--border-color);">
                                    Your Workspaces
                                </div>
                                ${this.userTeams.map(t => `
                                <a href="#" onclick="API.switchTeam(${t.team_id}); return false;" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; color: ${t.team_id === this.currentUser.team_id ? 'var(--primary)' : 'var(--text-main)'}; font-weight: ${t.team_id === this.currentUser.team_id ? '700' : '500'}; font-size: 0.86rem; background: ${t.team_id === this.currentUser.team_id ? 'var(--primary-light)' : 'transparent'};">
                                    <span>${t.team_name}</span>
                                    ${t.team_id === this.currentUser.team_id ? '<span style="font-size: 0.7rem; background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px;">Active</span>' : `<span style="font-size: 0.7rem; color: var(--text-muted);">${t.role.replace('_', ' ')}</span>`}
                                </a>
                                `).join('')}
                            </div>
                        </div>` : ''}

                        <!-- Notification Bell -->
                        <div style="position:relative;">
                            <button id="notifBtn" title="Notifications" style="background:none; border:none; cursor:pointer; padding:6px; position:relative; color:#64748b; display:flex; align-items:center; border-radius:var(--radius-sm); transition:var(--transition);">
                                <svg style="width:20px;height:20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                                <span id="notifBadge" style="display:none; position:absolute; top:0px; right:0px; background:#ef4444; color:#fff; font-size:0.6rem; font-weight:700; border-radius:10px; padding:1px 4px; min-width:14px; text-align:center; line-height:1.4;">0</span>
                            </button>
                            <div id="notifDropdown" style="display:none; position:absolute; right:0; top:calc(100% + 8px); width:min(320px, calc(100vw - 24px)); background:#fff; border-radius:10px; box-shadow:0 10px 25px rgba(0,0,0,0.15); border:1px solid #e2e8f0; z-index:1001; overflow:hidden;">
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid #f1f5f9; background:#f8fafc;">
                                    <span style="font-weight:700; font-size:0.82rem; color:#0f172a;">Notifications</span>
                                    <button onclick="API.markAllNotificationsRead().then(() => UI.initNotifications());" style="background:none; border:none; color:#2563eb; font-size:0.75rem; cursor:pointer; font-weight:600;">Mark all read</button>
                                </div>
                                <div class="notif-list" style="max-height:min(300px, 50vh); overflow-y:auto;"></div>
                            </div>
                        </div>

                        <span class="role-pill role-${this.currentUser.role.toLowerCase().replace('_', '-')}">
                            ${this.currentUser.role.replace('_', ' ')}
                        </span>

                        <a href="#" onclick="API.logout(); return false;" class="logout-btn" title="Logout">
                            <svg style="width:16px;height:16px;flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                            <span class="logout-text">Logout</span>
                        </a>
                    </div>
                </header>

                <main class="content-container" id="mainContainer">
                    ${pageInner}
                </main>
            </div>
        </div>
      `;

      // Wire interactive events
      this.initMobileSidebar();
      this.initTeamSwitcher();
      this.initNotifications();
    }

    return this.currentUser;
  },

  initMobileSidebar() {
    const toggleBtn = document.getElementById('menuToggle');
    const sidebar   = document.getElementById('sidebar');
    const overlay   = document.getElementById('sidebarOverlay');

    const closeSidebar = () => {
      sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
    };

    const openSidebar = () => {
      sidebar.classList.add('open');
      if (overlay) overlay.classList.add('open');
    };

    if (toggleBtn && sidebar) {
      toggleBtn.onclick = () => {
        if (sidebar.classList.contains('open')) {
          closeSidebar();
        } else {
          openSidebar();
        }
      };

      // Close sidebar when clicking overlay
      if (overlay) {
        overlay.onclick = closeSidebar;
      }

      // Auto-close sidebar when a nav item is clicked on mobile/tablet
      const navItems = sidebar.querySelectorAll('.nav-item');
      navItems.forEach(item => {
        item.addEventListener('click', () => {
          if (window.innerWidth < 1024) {
            closeSidebar();
          }
        });
      });

      // Swipe-to-close gesture on sidebar
      let touchStartX = 0;
      sidebar.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });

      sidebar.addEventListener('touchend', (e) => {
        const diff = touchStartX - e.changedTouches[0].clientX;
        if (diff > 60) { // swipe left by 60px = close
          closeSidebar();
        }
      }, { passive: true });

      // Swipe-from-left-edge to open sidebar
      document.addEventListener('touchstart', (e) => {
        if (e.touches[0].clientX < 20) {
          touchStartX = e.touches[0].clientX;
        }
      }, { passive: true });

      document.addEventListener('touchend', (e) => {
        if (touchStartX < 20) {
          const diff = e.changedTouches[0].clientX - touchStartX;
          if (diff > 60 && window.innerWidth < 1024 && !sidebar.classList.contains('open')) {
            openSidebar();
          }
        }
        touchStartX = 0;
      }, { passive: true });

      // Close sidebar on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
          closeSidebar();
        }
      });
    }
  },


  initTeamSwitcher() {
    const switcherBtn = document.getElementById('teamSwitcherBtn');
    const switcherMenu = document.getElementById('teamSwitcherMenu');

    if (switcherBtn && switcherMenu) {
      switcherBtn.onclick = (e) => {
        e.stopPropagation();
        const isOpen = switcherMenu.style.display === 'block';
        switcherMenu.style.display = isOpen ? 'none' : 'block';
      };

      document.addEventListener('click', (e) => {
        if (!switcherMenu.contains(e.target) && e.target !== switcherBtn) {
          switcherMenu.style.display = 'none';
        }
      });
    }
  },

  async initNotifications() {
    const badge = document.getElementById('notifBadge');
    const notifBtn = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');

    const updateBadge = async () => {
      const res = await API.getNotifications();
      if (res && res.success && badge) {
        const count = res.unread_count || 0;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';

        if (notifDropdown) {
          const list = notifDropdown.querySelector('.notif-list');
          if (list) {
            if (res.data && res.data.length > 0) {
              list.innerHTML = res.data.slice(0, 10).map(n => `
                <div class="notif-item ${n.is_read ? 'read' : 'unread'}" onclick="UI.handleNotifClick(${n.id}, ${n.target_id || 'null'})" style="padding:10px 14px;border-bottom:1px solid #f1f5f9;cursor:pointer;background:${n.is_read ? '#fff' : '#f8fafc'};">
                  <div style="font-size:0.85rem;color:#0f172a;font-weight:${n.is_read ? '500' : '600'};">${n.message}</div>
                  <div style="font-size:0.72rem;color:#94a3b8;margin-top:4px;">${new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
              `).join('');
            } else {
              list.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:0.85rem;">No notifications</div>';
            }
          }
        }
      }
    };

    if (notifBtn && notifDropdown) {
      notifBtn.onclick = (e) => {
        e.stopPropagation();
        const isOpen = notifDropdown.style.display === 'block';
        notifDropdown.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) updateBadge();
      };

      document.addEventListener('click', (e) => {
        if (!notifDropdown.contains(e.target) && e.target !== notifBtn) {
          notifDropdown.style.display = 'none';
        }
      });
    }

    updateBadge();
    setInterval(updateBadge, 30000);
  },

  async handleNotifClick(notifId, targetTaskId) {
    await API.markNotificationRead(notifId);
    if (targetTaskId) {
      this.showTaskModal(targetTaskId);
    } else {
      window.location.reload();
    }
  },

  async showTaskModal(taskId) {
    if (!taskId) return;
    const res = await API.getTask(taskId);
    if (!res || !res.success || !res.data) {
      UI.showToast(res ? res.message : 'Could not load task details.', 'danger');
      return;
    }
    const t = res.data;
    const user = this.currentUser || {};
    const canEdit = user.role === 'SUPER_ADMIN' || (user.role === 'ADMIN' && t.team_id === user.team_id);
    const isAssignedToMe = t.assigned_to === user.id;

    const existingModal = document.getElementById('tpTaskDetailModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'tpTaskDetailModal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15,23,42,0.6); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 2000; padding: 16px; animation: fadeIn 0.2s ease;
    `;

    modal.innerHTML = `
      <div style="background:#fff; width:100%; max-width:560px; max-height:90vh; overflow-y:auto; border-radius:16px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1); border:1px solid #e2e8f0; padding:24px; position:relative;">
        <button onclick="document.getElementById('tpTaskDetailModal').remove()" style="position:absolute; top:16px; right:16px; background:#f1f5f9; border:none; width:32px; height:32px; border-radius:50%; font-size:1.2rem; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#64748b;">&times;</button>
        
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
          <span class="priority-badge priority-${(t.priority || 'medium').toLowerCase()}">${t.priority} Priority</span>
          <span class="badge badge-${(t.status || 'pending').toLowerCase()}">${t.status}</span>
          ${t.team_name ? `<span style="font-size:0.78rem; background:#eff6ff; color:#2563eb; padding:2px 8px; border-radius:4px; font-weight:600;">${t.team_name}</span>` : ''}
        </div>

        <h2 style="font-size:1.25rem; font-weight:700; color:#0f172a; margin-bottom:12px; line-height:1.3;">${t.title}</h2>

        <div style="background:#f8fafc; padding:14px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:16px; font-size:0.9rem; color:#334155; white-space:pre-wrap; max-height:160px; overflow-y:auto;">
          ${t.description || '<em style="color:#94a3b8;">No description provided for this task.</em>'}
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:20px; font-size:0.85rem;">
          <div>
            <div style="color:#64748b; font-size:0.75rem; font-weight:600; text-transform:uppercase;">Assigned To</div>
            <div style="font-weight:600; color:#0f172a; margin-top:2px;">${t.assigned_user_name || 'Unassigned'}</div>
            ${t.assigned_user_email ? `<div style="font-size:0.75rem; color:#94a3b8;">${t.assigned_user_email}</div>` : ''}
          </div>
          <div>
            <div style="color:#64748b; font-size:0.75rem; font-weight:600; text-transform:uppercase;">Created By</div>
            <div style="font-weight:600; color:#0f172a; margin-top:2px;">${t.created_by_name || 'System'}</div>
          </div>
          <div>
            <div style="color:#64748b; font-size:0.75rem; font-weight:600; text-transform:uppercase;">Due Date</div>
            <div style="font-weight:600; color:#0f172a; margin-top:2px;">${t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No due date'}</div>
          </div>
          <div>
            <div style="color:#64748b; font-size:0.75rem; font-weight:600; text-transform:uppercase;">Completed At</div>
            <div style="font-weight:600; color:#10b981; margin-top:2px;">${t.completed_at ? new Date(t.completed_at.replace(' ', 'T')).toLocaleString() : '-'}</div>
          </div>
        </div>

        ${canEdit || isAssignedToMe ? `
        <div style="margin-bottom:20px; padding:12px; background:#eff6ff; border-radius:10px; border:1px solid #bfdbfe; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <label style="font-weight:600; font-size:0.85rem; color:#1e40af;">Update Status:</label>
          <select id="modalStatusSelect" onchange="UI.updateModalTaskStatus(${t.id}, this.value)" class="form-control" style="width:auto; padding:6px 12px; font-weight:600;">
            <option value="Pending" ${t.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Completed" ${t.status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="Overdue" ${t.status === 'Overdue' ? 'selected' : ''}>Overdue</option>
          </select>
        </div>
        ` : ''}

        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #f1f5f9; padding-top:16px;">
          ${canEdit ? `<a href="/task_form.html?id=${t.id}" class="btn btn-secondary btn-sm">Edit Task ✏️</a>` : ''}
          <button onclick="document.getElementById('tpTaskDetailModal').remove()" class="btn btn-primary btn-sm">Close</button>
        </div>
      </div>
    `;

    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    document.body.appendChild(modal);
  },

  async updateModalTaskStatus(taskId, newStatus) {
    const res = await API.updateTask(taskId, { status: newStatus });
    if (res.success) {
      UI.showToast(`Task status updated to ${newStatus}!`, 'success');
      const modal = document.getElementById('tpTaskDetailModal');
      if (modal) modal.remove();
      if (typeof window.loadTasks === 'function') window.loadTasks();
      else window.location.reload();
    } else {
      UI.showToast(res.message || 'Failed to update status', 'danger');
    }
  },
};

window.API = API;
window.UI = UI;
