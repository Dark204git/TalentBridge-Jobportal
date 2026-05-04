import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  console.error('VITE_API_URL is not set. API calls will fail.');
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  changePassword:  (data) => api.put('/auth/change-password', data),
  deleteAccount:   ()     => api.delete('/auth/account'),
  forgotPassword:  (data) => api.post('/auth/forgot-password', data),  // ✅ add
  resetPassword:   (data) => api.post('/auth/reset-password', data),
};

// Jobs
export const jobsAPI = {
  getJobs: (params) => api.get('/jobs', { params }),
  getJob: (id) => api.get(`/jobs/${id}`),
  createJob: (data) => api.post('/jobs', data),
  updateJob: (id, data) => api.put(`/jobs/${id}`, data),
  deleteJob: (id) => api.delete(`/jobs/${id}`),
  permanentDeleteJob: (id) => api.delete(`/jobs/${id}/permanent`),
  getMyJobs: () => api.get('/jobs/employer/mine'),
};

// Applications
export const applicationsAPI = {
  apply: (data) => api.post('/applications', data),
  getMine: () => api.get('/applications/mine'),
  getForJob: (jobId) => api.get(`/applications/job/${jobId}`),
  updateStatus: (id, data) => api.put(`/applications/${id}/status`, data),
  autoScreen: (jobId) => api.post(`/applications/job/${jobId}/auto-screen`),
  autoScreenAll: () => api.post('/applications/auto-screen-all'),
  deleteApplication: (id) => api.delete(`/applications/${id}`),
};

// Profiles
export const profilesAPI = {
  getCandidate: () => api.get('/profiles/candidate'),
  updateCandidate: (data) => api.put('/profiles/candidate', data),
  getEmployer: () => api.get('/profiles/employer'),
  updateEmployer: (data) => api.put('/profiles/employer', data),
  saveJob: (data) => api.post('/profiles/candidate/save-job', data),
  getSavedJobs: () => api.get('/profiles/candidate/saved-jobs'),
  // Resume
  getUploadUrl: (data) => api.post('/profiles/resume/upload-url', data),
  confirmUpload: (data) => api.post('/profiles/resume/confirm', data),
  getResumeStatus: () => api.get('/profiles/resume/status'),
  // Profile picture
  getPictureUploadUrl: (data) => api.post('/profiles/candidate/picture/upload-url', data),
  confirmPictureUpload: (data) => api.post('/profiles/candidate/picture/confirm', data),
};

// Analytics
export const analyticsAPI = {
  getEmployerDashboard: () => api.get('/analytics/employer/dashboard'),
  getEmployerStats:     () => api.get('/analytics/employer'),
  getCandidateStats:    () => api.get('/analytics/candidate'),
};

export const notificationsAPI = {
  getAll:      ()   => api.get('/notifications'),
  markRead:    (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: ()   => api.patch('/notifications/read-all'),
  delete:      (id) => api.delete(`/notifications/${id}`),
  clearAll:    ()   => api.delete('/notifications'),
};

export const matchingAPI = {
  // Candidate: get AI-matched jobs
  getMatchedJobs: (limit = 20) =>
    api.get(`/matching/jobs-for-me?limit=${limit}`),

  // Candidate: force refresh embedding
  reEmbedMe: () =>
    api.post('/matching/re-embed-me'),

  // Candidate: score for a specific job
  getScore: (jobId) =>
    api.get(`/matching/score/${jobId}`),

  // Employer: AI-ranked candidates for a job
  getCandidatesForJob: (jobId, limit = 20) =>
    api.get(`/jobs/${jobId}/matching-candidates?limit=${limit}`),
};


export default api;