/**
 * TaxTrack NG - Core Application JavaScript
 * Handles authentication, user data, transactions, and settings persistence
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
// Default Data
// ============================================
const DEFAULT_USER = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dob: '',
  employment: 'salary',
  company: '',
  taxId: '',
  taxOffice: '',
  createdAt: null
};

const DEFAULT_SETTINGS = {
  currency: 'NGN',
  financialYearStart: '01',
  emailNotifications: true,
  weeklyReports: true,
  theme: 'dark'
};

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

  // Initialize app
  init() {
    this.loadUser();
    this.loadTransactions();
    this.loadSettings();
    this.updateUIForAuthState();
  }

  // ==========================================
  // Authentication
  // ==========================================

  isLoggedIn() {
    return localStorage.getItem(STORAGE_KEYS.USER_LOGGED_IN) === 'true' && this.user !== null;
  }

  login(email, password, remember = false) {
    // Check if user exists
    const userData = this.getUserByEmail(email);
    
    if (userData) {
      // In a real app, you'd verify password hash
      // For demo, we just log them in
      localStorage.setItem(STORAGE_KEYS.USER_LOGGED_IN, 'true');
      this.user = userData;
      return { success: true, message: 'Login successful!' };
    }
    
    // Demo mode: create user on first login
    const newUser = {
      ...DEFAULT_USER,
      email: email,
      firstName: email.split('@')[0],
      lastName: 'User',
      createdAt: new Date().toISOString()
    };
    
    this.saveUser(newUser);
    localStorage.setItem(STORAGE_KEYS.USER_LOGGED_IN, 'true');
    this.user = newUser;
    
    return { success: true, message: 'Welcome! Account created.' };
  }

  signup(userData) {
    // Check if email already exists
    const existing = this.getUserByEmail(userData.email);
    if (existing) {
      return { success: false, message: 'An account with this email already exists.' };
    }

    const newUser = {
      ...DEFAULT_USER,
      ...userData,
      createdAt: new Date().toISOString()
    };

    this.saveUser(newUser);
    localStorage.setItem(STORAGE_KEYS.USER_LOGGED_IN, 'true');
    this.user = newUser;

    return { success: true, message: 'Account created successfully!' };
  }

  logout() {
    localStorage.removeItem(STORAGE_KEYS.USER_LOGGED_IN);
    this.user = null;
    window.location.href = 'login.html';
  }

  // ==========================================
  // User Data Management
  // ==========================================

  loadUser() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_DATA);
      if (data) {
        this.user = JSON.parse(data);
      }
    } catch (e) {
      console.error('Error loading user data:', e);
      this.user = null;
    }
  }

  saveUser(userData) {
    try {
      this.user = { ...this.user, ...userData };
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(this.user));
      return true;
    } catch (e) {
      console.error('Error saving user data:', e);
      return false;
    }
  }

  getUserByEmail(email) {
    // In a multi-user scenario, you'd have a users array
    // For single-user demo, we just check current user
    if (this.user && this.user.email === email) {
      return this.user;
    }
    return null;
  }

  getUser() {
    return this.user || { ...DEFAULT_USER };
  }

  updateProfile(updates) {
    return this.saveUser(updates);
  }

  // ==========================================
  // Transaction Management
  // ==========================================

  loadTransactions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      this.transactions = data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading transactions:', e);
      this.transactions = [];
    }
  }

  saveTransactions() {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(this.transactions));
      return true;
    } catch (e) {
      console.error('Error saving transactions:', e);
      return false;
    }
  }

  addTransaction(transaction) {
    const newTx = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      date: transaction.date || new Date().toISOString().split('T')[0],
      type: transaction.type,
      amount: Number(transaction.amount),
      details: transaction.details || '',
      createdAt: new Date().toISOString()
    };
    
    this.transactions.push(newTx);
    this.saveTransactions();
    return newTx;
  }

  deleteTransaction(id) {
    this.transactions = this.transactions.filter(tx => tx.id !== id);
    this.saveTransactions();
  }

  getTransactions() {
    return [...this.transactions];
  }

  getTransactionsByType(type) {
    return this.transactions.filter(tx => tx.type === type);
  }

  getTaxSummary() {
    const summary = {
      paye: 0,
      vat: 0,
      consumption: 0,
      total: 0,
      count: this.transactions.length
    };

    this.transactions.forEach(tx => {
      switch (tx.type) {
        case 'PAYE':
          summary.paye += tx.amount;
          break;
        case 'VAT':
          summary.vat += tx.amount;
          break;
        case 'Consumption':
          summary.consumption += tx.amount;
          break;
      }
    });

    summary.total = summary.paye + summary.vat + summary.consumption;
    return summary;
  }

  exportTransactionsCSV() {
    if (this.transactions.length === 0) {
      return null;
    }

    let csv = 'Date,Type,Amount (₦),Details\n';
    this.transactions.forEach(tx => {
      csv += `${tx.date},${tx.type},${tx.amount},"${tx.details}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `taxtrack_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
    return true;
  }

  // ==========================================
  // Settings Management
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
  // Tax Calculations
  // ==========================================

  calculatePAYE(grossIncome, reliefs = {}) {
    const pension = Number(reliefs.pension) || 0;
    const nhf = Number(reliefs.nhf) || 0;
    const other = Number(reliefs.other) || 0;
    
    // Standard relief: ₦200,000 + 20% of gross income
    const standardRelief = 200000 + (grossIncome * 0.2);
    const totalReliefs = pension + nhf + other + standardRelief;
    const taxable = Math.max(grossIncome - totalReliefs, 0);
    
    // Nigerian PAYE tax bands
    let tax = 0;
    if (taxable > 0) {
      if (taxable <= 300000) {
        tax = taxable * 0.07;
      } else if (taxable <= 600000) {
        tax = 21000 + (taxable - 300000) * 0.11;
      } else if (taxable <= 1100000) {
        tax = 54000 + (taxable - 600000) * 0.15;
      } else if (taxable <= 1600000) {
        tax = 129000 + (taxable - 1100000) * 0.19;
      } else if (taxable <= 3200000) {
        tax = 224000 + (taxable - 1600000) * 0.21;
      } else {
        tax = 560000 + (taxable - 3200000) * 0.24;
      }
    }

    return {
      grossIncome,
      totalReliefs,
      taxableIncome: taxable,
      annualTax: Math.round(tax),
      monthlyTax: Math.round(tax / 12)
    };
  }

  calculateVAT(amount) {
    return Math.round(amount * 0.075 * 100) / 100;
  }

  // ==========================================
  // UI Helpers
  // ==========================================

  updateUIForAuthState() {
    const isLoggedIn = this.isLoggedIn();
    
    // Update nav links if they exist
    const signInLinks = document.querySelectorAll('a[href="login.html"]');
    const dashboardLinks = document.querySelectorAll('a[href="dashboard.html"]');
    
    if (isLoggedIn && this.user) {
      signInLinks.forEach(link => {
        // Change "Sign In" to user name or "Dashboard"
        if (link.classList.contains('btn-nav') || link.textContent.includes('Sign In')) {
          link.href = 'dashboard.html';
          link.innerHTML = `<i class="fas fa-user-circle"></i> Dashboard`;
        }
      });
    }
  }

  formatCurrency(amount) {
    const currency = this.settings.currency || 'NGN';
    const symbol = currency === 'NGN' ? '₦' : '$';
    return `${symbol}${Number(amount).toLocaleString()}`;
  }

  showToast(message, type = 'success') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    `;
    
    // Add styles if not exists
    if (!document.getElementById('toast-styles')) {
      const styles = document.createElement('style');
      styles.id = 'toast-styles';
      styles.textContent = `
        .toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          padding: 16px 24px;
          background: rgba(19, 34, 56, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #fff;
          font-family: 'Outfit', sans-serif;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          z-index: 10000;
          animation: slideIn 0.3s ease-out;
        }
        .toast-success { border-left: 4px solid #00d4aa; }
        .toast-success i { color: #00d4aa; }
        .toast-error { border-left: 4px solid #ff6b6b; }
        .toast-error i { color: #ff6b6b; }
        .toast-info { border-left: 4px solid #74b9ff; }
        .toast-info i { color: #74b9ff; }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(styles);
    }
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ==========================================
  // Page Protection
  // ==========================================

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
}

// ============================================
// Initialize Global App Instance
// ============================================
const app = new TaxTrackApp();

// Make it globally available
window.TaxTrack = app;

// ============================================
// Utility Functions (Global)
// ============================================

function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString()}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-NG', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TaxTrackApp, STORAGE_KEYS };
}

