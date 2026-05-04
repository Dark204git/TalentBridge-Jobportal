import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';

// Employer Pages
import EmployerDashboard from './pages/employer/Dashboard';
import EmployerJobs from './pages/employer/Jobs';
import PostJob from './pages/employer/PostJob';
import EmployerApplications from './pages/employer/Applications';
import EmployerProfile from './pages/employer/Profile';
import EmployerAnalytics from './pages/employer/Analytics';

// Candidate Pages
import CandidateDashboard from './pages/candidate/Dashboard';
import CandidateProfile from './pages/candidate/Profile';
import CandidateApplications from './pages/candidate/Applications';
import SavedJobs from './pages/candidate/SavedJobs';

const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'employer' ? '/employer' : '/candidate'} replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  if (user) return <Navigate to={user.role === 'employer' ? '/employer' : '/candidate'} replace />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                style: { background: '#1a1a2e', color: '#e2e8f0', border: '1px solid #2d3a5c' },
                success: { iconTheme: { primary: '#f0c040', secondary: '#1a1a2e' } },
              }}
            />
            <Routes>
              {/* Public */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/:id" element={<JobDetailPage />} />
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
              <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

              {/* Employer */}
              <Route path="/employer" element={<ProtectedRoute role="employer"><EmployerDashboard /></ProtectedRoute>} />
              <Route path="/employer/jobs" element={<ProtectedRoute role="employer"><EmployerJobs /></ProtectedRoute>} />
              <Route path="/employer/jobs/new" element={<ProtectedRoute role="employer"><PostJob /></ProtectedRoute>} />
              <Route path="/employer/jobs/:id/edit" element={<ProtectedRoute role="employer"><PostJob /></ProtectedRoute>} />
              <Route path="/employer/applications" element={<ProtectedRoute role="employer"><EmployerApplications /></ProtectedRoute>} />
              <Route path="/employer/profile" element={<ProtectedRoute role="employer"><EmployerProfile /></ProtectedRoute>} />
              <Route path="/employer/analytics" element={<ProtectedRoute role="employer"><EmployerAnalytics /></ProtectedRoute>} />

              {/* Candidate */}
              <Route path="/candidate" element={<ProtectedRoute role="candidate"><CandidateDashboard /></ProtectedRoute>} />
              <Route path="/candidate/profile" element={<ProtectedRoute role="candidate"><CandidateProfile /></ProtectedRoute>} />
              <Route path="/candidate/applications" element={<ProtectedRoute role="candidate"><CandidateApplications /></ProtectedRoute>} />
              <Route path="/candidate/saved" element={<ProtectedRoute role="candidate"><SavedJobs /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>         
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
