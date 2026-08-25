import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../services/api';
import type { User, LoginRequest, RegisterRequest, Token } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [token, setToken]     = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
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
    // El sistema NO tiene registro/contenido demo: el login siempre valida
    // contra el backend real. Las cuentas las crean Admin → Súper Profesor.
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
      photo:                tokenData.photo ?? null,
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
    // Solo admin / super_profesor pueden crear cuentas (validado en el backend).
    await api.post('/auth/register', registerData);
    await login({ username: registerData.username, password: registerData.password });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, updateUser, isAuthenticated: !!user }}
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