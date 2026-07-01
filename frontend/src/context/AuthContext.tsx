import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../services/api';
import type { User, LoginRequest, RegisterRequest, Token } from '../types';

// false = backend real | true = demo offline sin backend
const DEMO_MODE = true;

// ─────────────────────────────────────────────────────────────────
// Usuarios demo por rol — credenciales temporales de prueba
//   demo        / demo1234          → Panel Estudiante
//   profesor    / profesor1234      → Panel Profesor
//   admin       / admin1234         → Panel Admin
//   superprofesor / superprofesor1234 → Panel Super Profesor (Rector)
// ─────────────────────────────────────────────────────────────────
const DEMO_USERS: Record<string, User & { _password: string }> = {
  demo: {
    _password: 'demo1234',
    id: 10,
    username: 'demo',
    email: 'estudiante@neurolearn.app',
    full_name: 'Estudiante Demo',
    role: 'estudiante',
    is_active: true,
    is_expert: false,
    created_at: new Date().toISOString(),
    cognitive_profile: null,
  },
  profesor: {
    _password: 'profesor1234',
    id: 20,
    username: 'profesor',
    email: 'profesor@neurolearn.app',
    full_name: 'Profesor Demo',
    role: 'profesor',
    is_active: true,
    is_expert: true,
    created_at: new Date().toISOString(),
    cognitive_profile: null,
  },
  admin: {
    _password: 'admin1234',
    id: 30,
    username: 'admin',
    email: 'admin@neurolearn.app',
    full_name: 'Admin Demo',
    role: 'admin',
    is_active: true,
    is_expert: false,
    created_at: new Date().toISOString(),
    cognitive_profile: null,
  },
  superprofesor: {
    _password: 'superprofesor1234',
    id: 40,
    username: 'superprofesor',
    email: 'rector@neurolearn.app',
    full_name: 'Rector Demo',
    role: 'super_profesor',
    is_active: true,
    is_expert: false,
    created_at: new Date().toISOString(),
    cognitive_profile: null,
  },
};

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
  const [user, setUser]       = useState<User | null>(null);
  const [token, setToken]     = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (DEMO_MODE) {
        // Restaurar sesión demo desde localStorage si existe
        const savedDemo = localStorage.getItem('demo_user');
        if (savedDemo) {
          try {
            setUser(JSON.parse(savedDemo));
          } catch {
            localStorage.removeItem('demo_user');
          }
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

  const login = async (loginData: LoginRequest): Promise<void> => {
    if (DEMO_MODE) {
      const demoEntry = DEMO_USERS[loginData.username];
      if (!demoEntry || demoEntry._password !== loginData.password) {
        throw new Error('Credenciales incorrectas. Usa las credenciales de demo.');
      }
      // Extraer _password antes de guardar el usuario
      const { _password: _, ...demoUser } = demoEntry;
      localStorage.setItem('demo_user', JSON.stringify(demoUser));
      setUser(demoUser);
      return;
    }

    const { data: tokenData } = await api.post<Token>('/auth/login', loginData);
    localStorage.setItem('token', tokenData.access_token);
    setToken(tokenData.access_token);

    const { data: userData } = await api.get<User>('/auth/me');
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const register = async (registerData: RegisterRequest): Promise<void> => {
    if (DEMO_MODE) {
      await login({ username: registerData.username, password: registerData.password });
      return;
    }
    await api.post('/auth/register', registerData);
    await login({ username: registerData.username, password: registerData.password });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('demo_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return context;
}