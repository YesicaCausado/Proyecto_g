import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../services/api';
import type { User, LoginRequest, RegisterRequest, Token } from '../types';

// ─── MODO DEMO (sin backend) ──────────────────────────────────────────────────
// Cambiar a false cuando el backend esté listo y se quiera activar el login real
const DEMO_MODE = true;

const DEMO_USER: User = {
  id: 1,
  username: 'demo',
  email: 'demo@neurolearn.app',
  full_name: 'Usuario Demo',
  role: 'estudiante',
  is_active: true,
  is_expert: false,
  created_at: new Date().toISOString(),
  cognitive_profile: null,
};
// ─────────────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Al iniciar, verificar si hay token guardado y cargar usuario
  useEffect(() => {
    const loadUser = async () => {
      if (DEMO_MODE) {
        // Intentar login real con usuario demo para obtener JWT verdadero
        try {
          const { data: tokenData } = await api.post<Token>('/auth/login', {
            username: 'demo',
            password: 'demo1234',
          });
          localStorage.setItem('token', tokenData.access_token);
          setToken(tokenData.access_token);
          const { data: userData } = await api.get<User>('/auth/me');
          setUser(userData);
        } catch {
          // Backend no disponible → usar usuario demo local sin JWT
          setUser(DEMO_USER);
        }
        setLoading(false);
        return;
      }
      if (token) {
        try {
          const { data } = await api.get<User>('/auth/me');
          setUser(data);
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  const login = async (loginData: LoginRequest) => {
    if (DEMO_MODE) { setUser(DEMO_USER); return; }
    const { data } = await api.post<Token>('/auth/login', loginData);
    localStorage.setItem('token', data.access_token);
    setToken(data.access_token);
    const { data: userData } = await api.get<User>('/auth/me');
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const register = async (registerData: RegisterRequest) => {
    if (DEMO_MODE) { setUser(DEMO_USER); return; }
    await api.post('/auth/register', registerData);
    await login({ username: registerData.username, password: registerData.password });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
