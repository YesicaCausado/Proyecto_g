import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import axios from 'axios';

import api, { clearApiCache } from '../services/api';

import type {
  User,
  LoginRequest,
  Token,
} from '../types';


// ============================================================================
// TIPOS
// ============================================================================

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  sessionError: string | null;

  login: (data: LoginRequest) => Promise<void>;
  logout: () => void;
  retrySession: () => Promise<void>;

  updateUser: (updates: Partial<User>) => void;

  isAuthenticated: boolean;
}


// ============================================================================
// CONTEXTO
// ============================================================================

const AuthContext = createContext<AuthContextType | null>(null);


// ============================================================================
// HELPERS
// ============================================================================

/**
 * Guarda el usuario de forma segura.
 */
function storeUser(user: User): void {
  localStorage.setItem(
    'user',
    JSON.stringify(user),
  );
}


/**
 * Limpia todos los datos locales relacionados con la sesión.
 */
function clearStoredSession(): void {
  clearApiCache();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

const USER_ROLES: readonly User['role'][] = [
  'estudiante',
  'profesor',
  'super_profesor',
  'admin',
];

function isUserRole(role: unknown): role is User['role'] {
  return typeof role === 'string' && USER_ROLES.includes(role as User['role']);
}

function isSessionUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<User>;
  return Boolean(
    typeof candidate.id === 'number' &&
    Number.isInteger(candidate.id) &&
    candidate.id > 0 &&
    typeof candidate.username === 'string' &&
    candidate.username.trim() &&
    isUserRole(candidate.role),
  );
}

class InvalidSessionResponseError extends Error {}

let sessionValidationPromise: Promise<User> | null = null;

function fetchSessionUser(): Promise<User> {
  if (!sessionValidationPromise) {
    sessionValidationPromise = api.get<unknown>('/auth/me', { timeout: 10_000 })
      .then(({ data }) => {
        if (!isSessionUser(data)) {
          throw new InvalidSessionResponseError('El servidor devolvió datos de sesión inválidos.');
        }
        return data;
      })
      .finally(() => {
        sessionValidationPromise = null;
      });
  }
  return sessionValidationPromise;
}


// ============================================================================
// PROVIDER
// ============================================================================

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {

  // --------------------------------------------------------------------------
  // Estado inicial
  // --------------------------------------------------------------------------

  const [user, setUser] = useState<User | null>(null);

  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('token'),
  );

  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const initializationStarted = useRef(false);


  // ==========================================================================
  // INICIALIZACIÓN DE SESIÓN
  // ==========================================================================

  const initializeSession = useCallback(async () => {
    setLoading(true);
    setSessionError(null);
    const currentToken = localStorage.getItem('token');

    if (!currentToken) {
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchSessionUser();
      setToken(currentToken);
      setUser(data);
      storeUser(data);
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const rejectedSession = status === 401 || status === 403;

      if (rejectedSession || error instanceof InvalidSessionResponseError) {
        clearStoredSession();
        delete api.defaults.headers.common.Authorization;
        setToken(null);
        setUser(null);
        return;
      }

      console.warn('No fue posible validar la sesión con el servidor.', error);
      setToken(currentToken);
      setUser(null);
      setSessionError(
        'No pudimos comprobar tu sesión por un problema de conexión. Verifica tu conexión e inténtalo de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initializationStarted.current) return;
    initializationStarted.current = true;
    void initializeSession();
  }, [initializeSession]);


  // ==========================================================================
  // LOGIN
  // ==========================================================================

  const login = async (
    loginData: LoginRequest,
  ): Promise<void> => {

    // Los errores de axios (401, 403, red, etc.) se propagan intactos
    // con su `response` para que LoginCard pueda interpretarlos.
    const {
      data: tokenData,
    } = await api.post<Token>(
      '/auth/login',
      loginData,
    );


    // ------------------------------------------------------------------------
    // Validación del token
    // ------------------------------------------------------------------------

    if (!tokenData?.access_token) {
      throw new Error(
        'El servidor no devolvió un token válido.',
      );
    }

    if (!isUserRole(tokenData.role)) {
      clearStoredSession();
      setToken(null);
      setUser(null);
      throw new Error('El servidor no devolvió un rol de usuario válido.');
    }

    // ------------------------------------------------------------------------
    // Validar ID (antes de guardar nada, para no dejar sesión a medias)
    // ------------------------------------------------------------------------

    if (
      tokenData.user_id === undefined ||
      tokenData.user_id === null
    ) {
      clearStoredSession();
      setToken(null);
      delete api.defaults.headers.common.Authorization;

      throw new Error(
        'La respuesta de autenticación no contiene el ID del usuario.',
      );
    }


    // ------------------------------------------------------------------------
    // Guardar token
    // ------------------------------------------------------------------------

    const accessToken =
      tokenData.access_token;

    localStorage.setItem(
      'token',
      accessToken,
    );

    setToken(accessToken);


    // ------------------------------------------------------------------------
    // Configurar Authorization en Axios
    //
    // Esto no reemplaza un interceptor si ya existe.
    // Simplemente garantiza que las peticiones posteriores al login
    // tengan el token disponible.
    // ------------------------------------------------------------------------

    api.defaults.headers.common.Authorization =
      `Bearer ${accessToken}`;


    // ------------------------------------------------------------------------
    // Construir usuario
    // ------------------------------------------------------------------------

    const userData: User = {

      id: tokenData.user_id,

      username:
        tokenData.username ??
        loginData.username,

      email:
        tokenData.email ??
        '',

      full_name:
        tokenData.full_name ??
        null,

      role:
        tokenData.role,

      is_active:
        tokenData.is_active ??
        true,

      is_expert:
        tokenData.is_expert ??
        false,

      photo:
        tokenData.photo ??
        null,

      created_at:
        tokenData.created_at ??
        new Date().toISOString(),

      cognitive_profile:
        tokenData.cognitive_profile ??
        null,

      must_change_password:
        tokenData.must_change_password ??
        false,

      institution_id:
        tokenData.institution_id ??
        undefined,

      institution_name:
        tokenData.institution_name ??
        null,

      document_number:
        tokenData.document_number ??
        undefined,

      privacy_notice_acknowledged_version:
        tokenData.privacy_notice_acknowledged_version ?? null,

      privacy_notice_required_version:
        tokenData.privacy_notice_required_version ?? null,
    };


    // ------------------------------------------------------------------------
    // Guardar usuario
    // ------------------------------------------------------------------------

    storeUser(userData);

    setUser(userData);
    setSessionError(null);


  };


  // ==========================================================================
  // LOGOUT
  // ==========================================================================

  const logout = (): void => {

    // ------------------------------------------------------------------------
    // Limpiar almacenamiento
    // ------------------------------------------------------------------------

    clearStoredSession();


    // ------------------------------------------------------------------------
    // Limpiar estado React
    // ------------------------------------------------------------------------

    setToken(null);
    setUser(null);
    setSessionError(null);


    // ------------------------------------------------------------------------
    // Limpiar Authorization de Axios
    // ------------------------------------------------------------------------

    delete api.defaults.headers.common.Authorization;
  };


  // ==========================================================================
  // ACTUALIZAR USUARIO
  // ==========================================================================

  const updateUser = (
    updates: Partial<User>,
  ): void => {

    setUser((previousUser) => {

      if (!previousUser) {
        return previousUser;
      }


      const nextUser: User = {
        ...previousUser,
        ...updates,
      };


      storeUser(nextUser);

      return nextUser;
    });
  };


  // ==========================================================================
  // VALOR DEL CONTEXTO
  // ==========================================================================

  const value: AuthContextType = {

    user,

    token,

    loading,
    sessionError,

    login,

    logout,
    retrySession: initializeSession,

    updateUser,

    isAuthenticated:
      Boolean(user && token),
  };


  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}


// ============================================================================
// HOOK
// ============================================================================

export function useAuth(): AuthContextType {

  const context =
    useContext(AuthContext);


  if (!context) {
    throw new Error(
      'useAuth debe usarse dentro de <AuthProvider>',
    );
  }


  return context;
}