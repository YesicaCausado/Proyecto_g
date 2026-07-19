import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../services/api';
import type { User, LoginRequest, RegisterRequest, Token } from '../types';

// false = backend real | true = demo offline sin backend
const DEMO_MODE = false;

// ─────────────────────────────────────────────────────────────────
// Usuarios demo por rol — credenciales temporales de prueba
//   demo        / demo            → Panel Estudiante
//   profesor    / profesor        → Panel Profesor
//   admin       / admin1234       → Panel Admin
//   superprofesor / superprofesor → Panel Super Profesor (Rector)
// ─────────────────────────────────────────────────────────────────
const DEMO_USERS: Record<string, User & { _password: string }> = {
  demo: {
    _password: 'demo',
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
    _password: 'profesor',
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
    _password: 'superprofesor',
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
        const savedDemo = localStorage.getItem('demo_user');
        if (savedDemo) {
          try { setUser(JSON.parse(savedDemo)); }
          catch { localStorage.removeItem('demo_user'); }
        }
        setLoading(false);
        return;
      }

      if (token) {
        // 1. Restaurar desde caché inmediatamente (sin esperar red)
        const cached = localStorage.getItem('user');
        if (cached) {
          try { setUser(JSON.parse(cached)); } catch { /* ignorar */ }
        }
        // 2. Validar token en background (sin bloquear la UI)
        api.get<User>('/auth/me')
          .then(({ data }) => {
            setUser(data);
            localStorage.setItem('user', JSON.stringify(data));
          })
          .catch(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
          })
          .finally(() => setLoading(false));
        return;
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

    // Construir user desde los datos del token (sin segundo request a /auth/me)
    const userData: User = {
      id:                   tokenData.user_id!,
      username:             tokenData.username ?? loginData.username,
      email:                tokenData.email ?? '',
      full_name:            tokenData.full_name ?? null,
      role:                 (tokenData.role ?? 'estudiante') as User['role'],
      is_active:            tokenData.is_active ?? true,
      is_expert:            tokenData.is_expert ?? false,
      created_at:           tokenData.created_at ?? new Date().toISOString(),
      cognitive_profile:    tokenData.cognitive_profile ?? null,
      must_change_password: tokenData.must_change_password ?? false,
      institution_id:       tokenData.institution_id ?? undefined,
      document_number:      tokenData.document_number ?? undefined,
    };
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