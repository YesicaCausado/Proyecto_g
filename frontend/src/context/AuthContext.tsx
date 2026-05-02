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
  }, [token]);

  const login = async (loginData: LoginRequest) => {
    const { data } = await api.post<Token>('/auth/login', loginData);
    localStorage.setItem('token', data.access_token);
    setToken(data.access_token);

    const { data: userData } = await api.get<User>('/auth/me');
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const register = async (registerData: RegisterRequest) => {
    await api.post('/auth/register', registerData);
    // Después de registrar, hacer login automático
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
