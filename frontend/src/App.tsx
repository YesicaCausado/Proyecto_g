import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import LoginPage from './pages/auth/LoginPage';
import ForceChangePassword from './pages/auth/ForceChangePassword';
import StudentDashboard from './pages/student/StudentDashboard';
import ChatPage from './pages/student/ChatPage';
import BotsPage from './pages/student/BotsPage';
import MyClassesPage from './pages/student/MyClassesPage';
import QuizzesPage from './pages/student/QuizzesPage';
import DesempenoPage from './pages/student/DesempenoPage';
import MaterialPage from './pages/student/MaterialPage';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import CreateClassroomPage from './pages/teacher/CreateClassroomPage';
import ClassroomDetailPage from './pages/teacher/ClassroomDetailPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import SuperDashboard from './pages/super/SuperDashboard';

function DashboardRouter() {
  const { user } = useAuth();
  // Fuerza cambio de contraseña en primer login
  if (user?.must_change_password) return <Navigate to="/change-password" replace />;
  if (user?.role === 'admin')          return <Navigate to="/admin" replace />;
  if (user?.role === 'super_profesor') return <Navigate to="/super" replace />;
  if (user?.role === 'profesor')       return <TeacherDashboard />;
  return <StudentDashboard />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login"    element={<LoginPage />} />
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
      <Route path="/my-classes" element={
        <ProtectedRoute role="estudiante"><Layout><MyClassesPage /></Layout></ProtectedRoute>
      } />
      <Route path="/quizzes" element={
        <ProtectedRoute role="estudiante"><Layout><QuizzesPage /></Layout></ProtectedRoute>
      } />
      <Route path="/performance" element={
        <ProtectedRoute role="estudiante"><Layout><DesempenoPage /></Layout></ProtectedRoute>
      } />
      <Route path="/material" element={
        <ProtectedRoute role="estudiante"><Layout><MaterialPage /></Layout></ProtectedRoute>
      } />

      {/* Profesor */}
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

      {/* Super Profesor */}
      <Route path="/super" element={
        <ProtectedRoute role="super_profesor"><Layout><SuperDashboard /></Layout></ProtectedRoute>
      } />
      <Route path="/super/*" element={
        <ProtectedRoute role="super_profesor"><Layout><SuperDashboard /></Layout></ProtectedRoute>
      } />

      {/* Admin */}
      <Route path="/admin/*" element={
        <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}