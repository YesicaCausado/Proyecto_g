import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LicenseProvider } from './context/LicenseContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// ── Carga diferida (code splitting) por ruta ───────────────────
// Cada página solo se descarga cuando el usuario navega a ella,
// reduciendo drásticamente el JS inicial (three.js, gsap, jspdf, etc.
// dejan de cargarse en cada visita a la aplicación).
const LandingPage          = lazy(() => import('./pages/landing/LandingPage'));
const LoginPage            = lazy(() => import('./pages/auth/LoginPage'));
const ForceChangePassword  = lazy(() => import('./pages/auth/ForceChangePassword'));
const ForgotPasswordPage   = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage    = lazy(() => import('./pages/auth/ResetPasswordPage'));
const StudentDashboard     = lazy(() => import('./pages/student/StudentDashboard'));
const ChatPage             = lazy(() => import('./pages/student/ChatPage'));
const BotsPage             = lazy(() => import('./pages/student/BotsPage'));
const MyClassesPage        = lazy(() => import('./pages/student/MyClassesPage'));
const ClassroomPage        = lazy(() => import('./pages/student/ClassroomPage'));
const QuizzesPage          = lazy(() => import('./pages/student/QuizzesPage'));
const DesempenoPage        = lazy(() => import('./pages/student/DesempenoPage'));
const MaterialPage         = lazy(() => import('./pages/student/MaterialPage'));
const TableroPage          = lazy(() => import('./pages/student/TableroPage'));
const MessagesPage         = lazy(() => import('./pages/student/MessagesPage'));
const CalendarPage         = lazy(() => import('./pages/student/CalendarPage'));
const SettingsPage         = lazy(() => import('./pages/student/SettingsPage'));
const TeacherDashboard     = lazy(() => import('./pages/teacher/TeacherDashboard'));
const TeacherPanel         = lazy(() => import('./pages/teacher/TeacherPanel'));
const CreateClassroomPage  = lazy(() => import('./pages/teacher/CreateClassroomPage'));
const ClassroomDetailPage  = lazy(() => import('./pages/teacher/ClassroomDetailPage'));
const AdminDashboard       = lazy(() => import('./pages/admin/AdminDashboard'));
const SuperDashboard       = lazy(() => import('./pages/super/SuperDashboard'));

// Fallback minimalista mientras carga cada ruta diferida.
function RouteLoader() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center text-slate-400"
      aria-busy="true"
    >
      <span>Cargando…</span>
    </div>
  );
}

function DashboardRouter() {
  const { user } = useAuth();
  // Fuerza cambio de contraseña en primer login
  if (user?.must_change_password) return <Navigate to="/change-password" replace />;
  if (user?.role === 'admin')          return <Navigate to="/admin" replace />;
  if (user?.role === 'super_profesor') return <Navigate to="/super" replace />;
  if (user?.role === 'profesor')       return <Navigate to="/teacher" replace />;
  return <StudentDashboard />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        {/* Landing en construcción: accesible en /landing mientras tanto.
        La raíz / apunta al login (página principal actual). */}
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        {/* Rutas públicas */}
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
        {/* Dashboard universal — redirige por rol */}
        <Route path="/dashboard" element={
          <ProtectedRoute><Layout><DashboardRouter /></Layout></ProtectedRoute>
        } />

        {/* Estudiante */}
        <Route path="/bots" element={
          <ProtectedRoute role="estudiante"><Layout><BotsPage /></Layout></ProtectedRoute>
        } />
        <Route path="/chat" element={
          <ProtectedRoute role="estudiante"><Layout><ChatPage /></Layout></ProtectedRoute>
        } />
        {/* Neuro-Chat por competencia: /chat/:slug (ej. /chat/logico-matematico).
            Mantiene la sección del estudiante y lleva directo a la competencia. */}
        <Route path="/chat/:slug" element={
          <ProtectedRoute role="estudiante"><Layout><ChatPage /></Layout></ProtectedRoute>
        } />
        <Route path="/my-classes" element={
          <ProtectedRoute role="estudiante"><Layout><MyClassesPage /></Layout></ProtectedRoute>
        } />
        <Route path="/my-classes/:id" element={
          <ProtectedRoute role="estudiante"><Layout><ClassroomPage /></Layout></ProtectedRoute>
        } />
        <Route path="/quizzes" element={
          <ProtectedRoute role="estudiante"><Layout><QuizzesPage /></Layout></ProtectedRoute>
        } />
        {/* Historial de quizzes dentro de la sección Desafíos */}
        <Route path="/quizzes/history" element={
          <ProtectedRoute role="estudiante"><Layout><QuizzesPage /></Layout></ProtectedRoute>
        } />
        <Route path="/performance" element={
          <ProtectedRoute role="estudiante"><Layout><DesempenoPage /></Layout></ProtectedRoute>
        } />
        <Route path="/material" element={
          <ProtectedRoute role="estudiante"><Layout><MaterialPage /></Layout></ProtectedRoute>
        } />
        <Route path="/tablero" element={
          <ProtectedRoute role="estudiante"><Layout><TableroPage /></Layout></ProtectedRoute>
        } />
        <Route path="/messages" element={
          <ProtectedRoute role="estudiante"><Layout><MessagesPage /></Layout></ProtectedRoute>
        } />
        <Route path="/calendar" element={
          <ProtectedRoute role="estudiante"><Layout><CalendarPage /></Layout></ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute role="estudiante"><Layout><SettingsPage /></Layout></ProtectedRoute>
        } />

        {/* Profesor — panel completo sin Layout */}
        <Route path="/teacher/*" element={
          <ProtectedRoute role="profesor"><TeacherPanel /></ProtectedRoute>
        } />

        {/* Rutas legacy del profesor (compatibilidad) */}
        <Route path="/classrooms" element={
          <ProtectedRoute role="profesor"><Layout><TeacherDashboard /></Layout></ProtectedRoute>
        } />
        <Route path="/classrooms/new" element={
          <ProtectedRoute role="profesor"><Layout><CreateClassroomPage /></Layout></ProtectedRoute>
        } />
        <Route path="/classrooms/:id" element={
          <ProtectedRoute role="profesor"><Layout><ClassroomDetailPage /></Layout></ProtectedRoute>
        } />

        {/* Cambio de contraseña forzado (primer login) */}
        <Route path="/change-password" element={
          <ProtectedRoute><ForceChangePassword /></ProtectedRoute>
        } />

        {/* Super Profesor — tiene su propio layout completo, sin <Layout> */}
        <Route path="/super" element={
          <ProtectedRoute role="super_profesor"><SuperDashboard /></ProtectedRoute>
        } />
        <Route path="/super/*" element={
          <ProtectedRoute role="super_profesor"><SuperDashboard /></ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="/admin/*" element={
          <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <LicenseProvider>
          <AppRoutes />
        </LicenseProvider>
      </AuthProvider>
    </HashRouter>
  );
}