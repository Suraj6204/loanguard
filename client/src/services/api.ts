import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Redirect to login if not already there
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================
// AUTH API
// ============================================================

export const authAPI = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// ============================================================
// BORROWER API
// ============================================================

export const borrowerAPI = {
  updateProfile: (data: {
    name: string;
    pan: string;
    dateOfBirth: string;
    monthlySalary: number;
    employmentMode: string;
  }) => api.post('/borrower/profile', data),
  checkEligibility: () => api.get('/borrower/eligibility'),
};

// ============================================================
// DOCUMENT API
// ============================================================

export const documentAPI = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getById: (id: string) => api.get(`/documents/${id}`),
  getMyDocuments: () => api.get('/documents/me'),
  view: (id: string) => api.get(`/documents/${id}/view`, { responseType: 'blob' }),
};

// ============================================================
// LOAN / APPLICATION API
// ============================================================

export const loanAPI = {
  calculate: (data: { principal: number; tenureDays: number }) =>
    api.post('/applications/calculate', data),
  create: (data: { principal: number; tenureDays: number; documentId: string }) =>
    api.post('/applications/apply', data),
  getMyApplications: () => api.get('/applications/me'),
  getById: (id: string) => api.get(`/applications/${id}`),
  getTimeline: (id: string) => api.get(`/loans/${id}/timeline`),
  getPayments: (id: string) => api.get(`/loans/${id}/payments`),

  // Operations
  sanction: (id: string) => api.post(`/loans/${id}/sanction`),
  reject: (id: string, reason: string) =>
    api.post(`/loans/${id}/reject`, { reason }),
  disburse: (id: string) => api.post(`/loans/${id}/disburse`),
  recordPayment: (id: string, data: { utrNumber: string; amount: number; paymentDate: string }) =>
    api.post(`/loans/${id}/payments`, data),
};

// ============================================================
// OPERATIONS API
// ============================================================

export const operationsAPI = {
  getSanctionQueue: (page = 1, limit = 20) =>
    api.get(`/operations/sanction/loans?page=${page}&limit=${limit}`),
  getDisbursementQueue: (page = 1, limit = 20, status?: string) =>
    api.get(`/operations/disbursement/loans?page=${page}&limit=${limit}${status ? `&status=${status}` : ''}`),
  getCollectionLoans: (page = 1, limit = 20) =>
    api.get(`/operations/collection/loans?page=${page}&limit=${limit}`),
  getSalesLeads: (page = 1, limit = 20) =>
    api.get(`/operations/sales/leads?page=${page}&limit=${limit}`),
  getDashboard: () => api.get('/admin/dashboard'),
  getAuditLogs: (page = 1, limit = 20, filters?: Record<string, string>) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), ...filters });
    return api.get(`/admin/audit-logs?${params}`);
  },
};

export default api;
