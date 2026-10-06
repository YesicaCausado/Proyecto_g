import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';

import api from '../services/api';

import type {
  User,
  LoginRequest,
  RegisterRequest,
  Token,
} from '../types';


// ============================================================================
// TIPOS
// ============================================================================

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


// ============================================================================
// CONTEXTO
// ============================================================================

const AuthContext = createContext<AuthContextType | null>(null);


// ============================================================================
// HELPERS
// ============================================================================

/**
 * Obtiene el usuario guardado en localStorage.
 *
 * Si el contenido está corrupto, se elimina y se devuelve null.
 */
function getStoredUser(): User | null {
  try {
    const cached = localStorage.getItem('user');

    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached);

    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem('user');
      return null;
    }

    return parsed as User;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}


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
  localStorage.removeItem('token');
  localStorage.removeItem('user');
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

  const [user, setUser] = useState<User | null>(
    getStoredUser,
  );

  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('token'),
  );

  const [loading, setLoading] = useState(true);


  // ==========================================================================
  // INICIALIZACIÓN DE SESIÓN
  // ==========================================================================

  useEffect(() => {

    let mounted = true;

    const initAuth = async () => {

      const currentToken =
        localStorage.getItem('token');

      // ----------------------------------------------------------------------
      // No existe sesión
      // ----------------------------------------------------------------------

      if (!currentToken) {

        if (mounted) {
          setToken(null);
          setUser(null);
          setLoading(false);
        }

        return;
      }


      // ----------------------------------------------------------------------
      // Existe token: validarlo contra backend
      // ----------------------------------------------------------------------

      try {

        const { data } =
          await api.get<User>('/auth/me');


        // --------------------------------------------------------------------
        // Validación mínima de respuesta
        // --------------------------------------------------------------------

        if (
          !data ||
          typeof data !== 'object' ||
          !data.id ||
          !data.username ||
          !data.role
        ) {
          throw new Error(
            'Respuesta de usuario inválida.',
          );
        }


        if (!mounted) {
          return;
        }


        // --------------------------------------------------------------------
        // Sesión válida
        // --------------------------------------------------------------------

        setToken(currentToken);
        setUser(data);

        storeUser(data);

      } catch (error) {

        // --------------------------------------------------------------------
        // Token inválido / expirado / usuario eliminado
        // --------------------------------------------------------------------

        console.warn(
          'La sesión actual no es válida. Se cerrará la sesión.',
          error,
        );

        if (!mounted) {
          return;
        }

        clearStoredSession();
        delete api.defaults.headers.common.Authorization;

        setToken(null);
        setUser(null);

      } finally {

        if (mounted) {
          setLoading(false);
        }
      }
    };


    initAuth();


    // ------------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------------

    return () => {
      mounted = false;
    };

  }, []);


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
        (tokenData.role ??
          'estudiante') as User['role'],

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

      document_number:
        tokenData.document_number ??
        undefined,
    };


    // ------------------------------------------------------------------------
    // Guardar usuario
    // ------------------------------------------------------------------------

    storeUser(userData);

    setUser(userData);


  };


  // ==========================================================================
  // REGISTRO
  // ==========================================================================

  const register = async (
    registerData: RegisterRequest,
  ): Promise<void> => {

    await api.post(
      '/auth/register',
      registerData,
    );


    // ------------------------------------------------------------------------
    // Después de registrar, iniciar sesión
    // ------------------------------------------------------------------------

    await login({
      username: registerData.username,
      password: registerData.password,
    });
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

    login,

    register,

    logout,

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