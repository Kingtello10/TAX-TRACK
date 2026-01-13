/**
 * TaxTrack NG - Frontend JS (Live Backend Integrated)
 * Handles authentication, transactions, receipts, CSV upload, and settings
 */

// ============================================
// Storage Keys
// ============================================
const STORAGE_KEYS = {
  USER_LOGGED_IN: 'taxtrack_loggedIn',
  USER_DATA: 'taxtrack_userData',
  TRANSACTIONS: 'taxtrack_transactions',
  SETTINGS: 'taxtrack_settings'
};

// ============================================
// Default Settings
// ============================================
const DEFAULT_SETTINGS = {
  currency: 'NGN',
  financialYearStart: '01',
  emailNotifications: true,
  weeklyReports: true,
  theme: 'dark'
};

// ============================================
// Backend URL
// ============================================
const API_BASE = "https://taxtrack-backend.onrender.com";

// ============================================
// TaxTrack App Class
// ============================================
class TaxTrackApp {
  constructor() {
    this.user = null;
    this.transactions = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.init();
  }

  init() {
    this.loadUserFromStorage();
    this.loadSettings();
    this.updateUIForAuthState();
    this.bindAuthForms(); // <-- bind login/signup forms automatically
  }

  // ==========================================
  // Authentication
  // ==========================================
  async login(email, password) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok) {
        const userWithToken = { ...data.user, token: data.token };
        localStorage.setItem(STORAGE_KEYS.USER_LOGGED_IN, 'true');
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userWithToken));
        this.user = userWithToken;
        return { success: true, message: 'Login successful!' };
      } else {
        return { success: false, message: data.message || 'Login failed' };
      }
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, message: 'Network error' };
    }
  }

  async signup(userData) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await res.json();

      if (res.ok) {
        const userWithToken = { ...data.user, token: data.token };
        localStorage.setItem(STORAGE_KEYS.USER_LOGGED_IN, 'true');
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userWithToken));
        this.user = userWithToken;
        return { success: true, message: 'Account created!' };
      } else {
        return { success: false, message: data.message || 'Signup failed' };
      }
    } catch (err) {
      console.error('Signup error:', err);
      return { success: false, message: 'Network error' };
    }
  }

  logout() {
    localStorage.removeItem(STORAGE_KEYS.USER_LOGGED_IN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    this.user = null;
    window.location.href = 'login.html';
  }

  loadUserFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_DATA);
      if (data) this.user = JSON.parse(data);
    } catch (e) {
      console.error('Error loading user:', e);
      this.user = null;
    }
  }

  isLoggedIn() {
    return localStorage.getItem(STORAGE_KEYS.USER_LOGGED_IN) === 'true' && this.user !== null;
  }

  // ==========================================
  // Transactions via Backend
  // ==========================================
  async addTransaction(transaction) {
    if (!this.user || !this.user.token) return { success: false, message: 'Not logged in' };
    try {
      const res = await fetch(`${API_BASE}/api/tax`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.user.token}` },
        body: JSON.stringify(transaction)
      });
      const data = await res.json();
      if (res.ok) {
        this.transactions.push(data);
        return { success: true, transaction: data };
      } else {
        return { success: false, message: data.message || 'Failed to add transaction' };
      }
    } catch (err) {
      console.error('Add transaction error:', err);
      return { success: false, message: 'Network error' };
    }
  }

  async fetchTransactions() {
    if (!this.user || !this.user.token) return [];
    try {
      const res = await fetch(`${API_BASE}/api/tax`, { headers: { 'Authorization': `Bearer ${this.user.token}` } });
      const data = await res.json();
      if (res.ok) this.transactions = data;
      return this.transactions;
    } catch (err) {
      console.error('Fetch transactions error:', err);
      return [];
    }
  }

  // ==========================================
  // Receipts & CSV Upload
  // ==========================================
  async uploadFile(file, type = 'receipt') {
    if (!this.user || !this.user.token) return { success: false, message: 'Not logged in' };
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const res = await fetch(`${API_BASE}/api/receipts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.user.token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        this.transactions.push(...data.transactions);
        return { success: true, transactions: data.transactions };
      } else {
        return { success: false, message: data.message || 'Upload failed' };
      }
    } catch (err) {
      console.error('Upload error:', err);
      return { success: false, message: 'Network error' };
    }
  }

  async fetchReceipts() {
    if (!this.user || !this.user.token) return [];
    try {
      const res = await fetch(`${API_BASE}/api/receipts`, { headers: { 'Authorization': `Bearer ${this.user.token}` } });
      const data = await res.json();
      if (res.ok) return data;
      else return [];
    } catch (err) {
      console.error('Fetch receipts error:', err);
      return [];
    }
  }

  // ==========================================
  // Settings
  // ==========================================
  loadSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      this.settings = data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.error('Error loading settings:', e);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(newSettings) {
    try {
      this.settings = { ...this.settings, ...newSettings };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
      return true;
    } catch (e) {
      console.error('Error saving settings:', e);
      return false;
    }
  }

  getSettings() {
    return { ...this.settings };
  }

  // ==========================================
  // UI Helpers
  // ==========================================
  updateUIForAuthState() {
    const isLoggedIn = this.isLoggedIn();
    const signInLinks = document.querySelectorAll('a[href="login.html"]');
    const dashboardLinks = document.querySelectorAll('a[href="dashboard.html"]');

    if (isLoggedIn && this.user) {
      signInLinks.forEach(link => {
        link.href = 'dashboard.html';
        link.innerHTML = `<i class="fas fa-user-circle"></i> Dashboard`;
      });
    }
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
      <span>${message}</span>`;
    if (!document.getElementById('toast-styles')) {
      const styles = document.createElement('style');
      styles.id = 'toast-styles';
      styles.textContent = `
        .toast { position: fixed; bottom: 24px; right: 24px; padding: 16px 24px; background: rgba(19, 34, 56, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; color: #fff; font-family: 'Outfit', sans-serif; font-size: 0.95rem; display: flex; align-items: center; gap: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); z-index:10000; animation: slideIn 0.3s ease-out; }
        .toast-success { border-left: 4px solid #00d4aa; } .toast-success i { color: #00d4aa; }
        .toast-error { border-left: 4px solid #ff6b6b; } .toast-error i { color: #ff6b6b; }
        .toast-info { border-left: 4px solid #74b9ff; } .toast-info i { color: #74b9ff; }
        @keyframes slideIn { from { transform: translateX(100%); opacity:0; } to { transform: translateX(0); opacity:1; } }
        @keyframes slideOut { from { transform: translateX(0); opacity:1; } to { transform: translateX(100%); opacity:0; } }
      `;
      document.head.appendChild(styles);
    }
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  redirectIfLoggedIn(destination = 'dashboard.html') {
    if (this.isLoggedIn()) {
      window.location.href = destination;
      return true;
    }
    return false;
  }

  formatCurrency(amount) {
    const currency = this.settings.currency || 'NGN';
    const symbol = currency === 'NGN' ? '₦' : '$';
    return `${symbol}${Number(amount).toLocaleString()}`;
  }

  // ==========================================
  // Auto-bind login/signup forms
  // ==========================================
  bindAuthForms() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const result = await this.login(email, password);
        this.showToast(result.message, result.success ? 'success' : 'error');
        if (result.success) window.location.href = 'dashboard.html';
      });
    }

    if (signupForm) {
      signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('fullName').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const result = await this.signup({ fullName, email, password });
        this.showToast(result.message, result.success ? 'success' : 'error');
        if (result.success) window.location.href = 'dashboard.html';
      });
    }
  }
}

// ============================================
// Initialize Global App Instance
// ============================================
const app = new TaxTrackApp();
window.TaxTrack = app;

// ============================================
// Utility Functions
// ============================================
function formatNaira(amount) { return `₦${Number(amount).toLocaleString()}`; }
function formatDate(dateStr) { return new Date(dateStr).toLocaleDateString('en-NG', { year:'numeric', month:'short', day:'numeric' }); }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TaxTrackApp, STORAGE_KEYS };
}
