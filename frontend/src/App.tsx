import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import StudentDashboard from './pages/student/StudentDashboard';
import ChatPage from './pages/student/ChatPage';
import BotsPage from './pages/student/BotsPage';
import MyClassesPage from './pages/student/MyClassesPage';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import CreateClassroomPage from './pages/teacher/CreateClassroomPage';
import ClassroomDetailPage from './pages/teacher/ClassroomDetailPage';

function DashboardRouter() {
  const { user } = useAuth();
  if (user?.role === 'admin')          return <Navigate to="/admin" replace />;
  if (user?.role === 'super_profesor') return <Navigate to="/super-dashboard" replace />;
  if (user?.role === 'profesor')       return <TeacherDashboard />;
  return <StudentDashboard />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

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