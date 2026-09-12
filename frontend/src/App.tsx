import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './routes/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import { Role } from './types';

// Pages
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';
import Dashboard from './pages/Dashboard';
import CalendarPage from './pages/Calendar';
import AppointmentsPage from './pages/Appointments';
import { CreateEditRdvPage, ConsultationCreatePage } from './pages/CreateEditRdv';
import PatientsPage from './pages/Patients';
import PatientDetailPage from './pages/PatientDetail';
import CreatePatientPage from './pages/CreatePatient';
import ConsultationsPage from './pages/Consultations';
import ProfilePage from './pages/Profile';
import UserManagementPage from './pages/UserManagement';
import ActivityLogsPage from './pages/ActivityLogs';
import PrescriptionPrintPage from './pages/PrescriptionPrint';
import PrescriptionsPage from './pages/Prescriptions';
import OnCallSchedulePage from './pages/OnCallSchedulePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const App: React.FC = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = i18n.dir();
    document.documentElement.lang = i18n.language;
  }, [i18n, i18n.language]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Protected routes with layout */}
              <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/appointments" element={<AppointmentsPage />} />
                  <Route path="/appointments/new" element={<CreateEditRdvPage />} />
                  <Route path="/appointments/:id" element={<CreateEditRdvPage />} />
                  <Route path="/patients" element={<PatientsPage />} />
                  <Route path="/patients/new" element={<CreatePatientPage />} />
                  <Route path="/patients/:id" element={<PatientDetailPage />} />
                  <Route path="/consultations" element={<ConsultationsPage />} />
                  <Route path="/prescriptions" element={<PrescriptionsPage />} />
                  <Route path="/planning" element={<OnCallSchedulePage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/ordonnance/:id/print" element={<PrescriptionPrintPage />} />

                  {/* Admin-only routes */}
                  <Route
                    element={<ProtectedRoute allowedRoles={[Role.ADMIN]} />}
                  >
                    <Route path="/admin/users" element={<UserManagementPage />} />
                    <Route path="/admin/logs" element={<ActivityLogsPage />} />
                  </Route>

                  <Route
                    element={<ProtectedRoute allowedRoles={[Role.MEDECIN, Role.ADMIN]} />}
                  >
                    <Route path="/consultations/new" element={<ConsultationCreatePage />} />
                    <Route path="/consultations/:id" element={<ConsultationCreatePage />} />
                  </Route>
                </Route>
              </Route>

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
