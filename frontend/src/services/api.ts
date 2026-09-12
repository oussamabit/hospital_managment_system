import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { CreateConsultationDto } from '../types';

const BASE_URL = '/api';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Send cookies (refresh token)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach access token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else if (token) {
      resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor: Handle 401 + refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      // Don't retry for login/refresh routes themselves
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const { accessToken } = response.data;

        localStorage.setItem('accessToken', accessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        // Redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ===== Typed API functions =====

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: Record<string, string>) => api.put('/auth/profile', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),
  getDoctors: () => api.get('/auth/doctors'),
};

// Patients
export const patientApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/patients', { params }),
  getById: (id: string) => api.get(`/patients/${id}`),
  create: (data: Record<string, unknown>) => api.post('/patients', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/patients/${id}`, data),
  delete: (id: string) => api.delete(`/patients/${id}`),
};

// RendezVous
export const rdvApi = {
  getAll: (params?: Record<string, string | number>) => api.get('/rdv', { params }),
  getById: (id: string) => api.get(`/rdv/${id}`),
  getToday: () => api.get('/rdv/today'),
  getStats: () => api.get('/rdv/stats'),
  create: (data: Record<string, unknown>) => api.post('/rdv', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/rdv/${id}`, data),
  cancel: (id: string, cancelReason?: string) =>
    api.patch(`/rdv/${id}/cancel`, { cancelReason }),
  delete: (id: string) => api.delete(`/rdv/${id}`),
};

// Consultations
export const consultationApi = {
  create: (data: Record<string, unknown>) => api.post('/consultations', data),
  getById: (id: string) => api.get(`/consultations/${id}`),
  getByRdv: (rdvId: string) => api.get(`/consultations/rdv/${rdvId}`),
  getByPatient: (patientId: string) => api.get(`/consultations/patient/${patientId}`),
  getAll: (params?: { page?: number; limit?: number; patient?: string; medecin?: string }) =>
    api.get('/consultations', { params }),
  update: (id: string, data: Partial<CreateConsultationDto>) => api.put(`/consultations/${id}`, data),
  delete: (id: string) => api.delete(`/consultations/${id}`),
};

// Users (Admin)
export const userApi = {
  getAll: () => api.get('/users'),
  getPending: () => api.get('/users/pending'),
  getById: (id: string) => api.get(`/users/${id}`),
  approve: (id: string) => api.patch(`/users/${id}/approve`),
  updateRole: (id: string, role: string) => api.patch(`/users/${id}/role`, { role }),
  terminate: (id: string) => api.patch(`/users/${id}/terminate`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
};

// Services
export const serviceApi = {
  getAll: () => api.get('/services'),
  getById: (id: string) => api.get(`/services/${id}`),
  create: (data: { nomService: string; chefDeServiceId: string }) => api.post('/services', data),
};

// Options
export const optionApi = {
  getAll: (category?: string) => api.get(`/options${category ? `?category=${category}` : ''}`),
  create: (data: { category: string; value: string }) => api.post('/options', data),
  delete: (id: string) => api.delete(`/options/${id}`),
};

// Audit
export const auditApi = {
  getLogs: (params?: any) => api.get('/audit', { params }),
  undo: (id: string) => api.post(`/audit/${id}/undo`),
};

// Ordonnances
export const ordonnanceApi = {
  getAll: (params?: { patient?: string; medecin?: string }) => api.get('/ordonnances', { params }),
  create: (data: any) => api.post('/ordonnances', data),
  getById: (id: string) => api.get(`/ordonnances/${id}`),
  getByConsultation: (consultationId: string) => api.get(`/ordonnances/consultation/${consultationId}`),
  update: (id: string, data: any) => api.patch(`/ordonnances/${id}`, data),
  delete: (id: string) => api.delete(`/ordonnances/${id}`),
};

// Hospitalisations
export const hospitalizationApi = {
  getByPatient: (patientId: string) =>
    api.get(`/hospitalizations/patient/${patientId}`),
  getById: (id: string) => api.get(`/hospitalizations/${id}`),
  create: (patientId: string, data: Record<string, unknown>) =>
    api.post(`/hospitalizations/patient/${patientId}`, data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/hospitalizations/${id}`, data),
  delete: (id: string) => api.delete(`/hospitalizations/${id}`),
  addFollowup: (id: string, data: { date: string; notes: string; evolution?: string }) =>
    api.post(`/hospitalizations/${id}/followup`, data),
  deleteFollowup: (id: string, followupId: string) =>
    api.delete(`/hospitalizations/${id}/followup/${followupId}`),
  uploadImaging: (id: string, formData: FormData) =>
    api.post(`/hospitalizations/${id}/imaging`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteImaging: (id: string, imagingType: string, fileId: string) =>
    api.delete(`/hospitalizations/${id}/imaging/${imagingType}/${fileId}`),

  // Serie DICOM (dossier complet)
  uploadDicomSeries: (id: string, formData: FormData, onProgress?: (pct: number) => void) =>
    api.post(`/hospitalizations/${id}/imaging-series`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      },
    }),
  downloadDicomSeries: (id: string, seriesId: string) =>
    api.get(`/hospitalizations/${id}/imaging-series/${seriesId}/download`, { responseType: 'blob' }),
  deleteDicomSeries: (id: string, seriesId: string) =>
    api.delete(`/hospitalizations/${id}/imaging-series/${seriesId}`),
};

// Planning de garde (On-Call)
export const onCallApi = {
  getRange: (from: string, to: string) =>
    api.get(`/on-call/range?from=${from}&to=${to}`),
  getByDate: (date: string) =>
    api.get(`/on-call/date/${date}`),
  getDoctorsOnCall: (date: string) =>
    api.get(`/on-call/doctors-on-call/${date}`),
  getAvailableSlots: (doctorId: string, date: string) =>
    api.get(`/on-call/available-slots/${doctorId}/${date}`),
  upsert: (data: Record<string, unknown>) =>
    api.post('/on-call', data),
  publish: (id: string, isPublished: boolean) =>
    api.patch(`/on-call/${id}/publish`, { isPublished }),
  delete: (id: string) =>
    api.delete(`/on-call/${id}`),
  getConstraints: (doctorId: string) =>
    api.get(`/on-call/constraints/${doctorId}`),
  saveConstraints: (doctorId: string, data: Record<string, unknown>) =>
    api.put(`/on-call/constraints/${doctorId}`, data),
};

// RDV Intelligent (smart)
export const rdvSmartApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/rdv-smart', { params }),
  getById: (id: string) =>
    api.get(`/rdv-smart/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post('/rdv-smart', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/rdv-smart/${id}`, data),
  cancel: (id: string, reason?: string) =>
    api.patch(`/rdv-smart/${id}/cancel`, { reason }),
  delete: (id: string) =>
    api.delete(`/rdv-smart/${id}`),
  getCancelledSlots: (params?: { from?: string; to?: string }) =>
    api.get('/rdv-smart/cancelled-slots', { params }),
  getRescheduleSuggestions: (rdvId: string) =>
    api.get(`/rdv-smart/${rdvId}/reschedule-suggestions`),
};

export const documentApi = {
  upload: (formData: FormData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getByPatient: (patientId: string) => api.get(`/documents/patient/${patientId}`),
  delete: (id: string) => api.delete(`/documents/${id}`),
};
