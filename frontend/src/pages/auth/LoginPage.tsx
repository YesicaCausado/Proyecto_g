import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Brain, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form);
      navigate('/dashboard');
    } catch (err: unknown) {
      // Maneja tanto errores de Axios como errores de demo (Error nativo)
      if (err instanceof Error) {
        setError(err.message);
      } else {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(axiosErr.response?.data?.detail || 'Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-400/10 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-600 rounded-md flex items-center justify-center mx-auto mb-4">
            <Brain className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#191919]">NeuroLearn AI</h1>
          <p className="text-[#787774] mt-1">Plataforma Inteligente de Aprendizaje</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-md border border-[#E9E9E7] p-8">
          <h2 className="text-xl font-semibold text-[#191919] mb-6">Iniciar Sesión</h2>

          {error && (
            <div className="bg-[#FDEEEE] border border-[#F4BDBD] text-[#E03E3E] text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#787774] mb-1">
                Usuario
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-4 py-2.5 border border-[#E9E9E7] rounded-md focus:ring-1 focus:ring-[#37352F] focus:border-[#37352F] outline-none transition-colors text-sm text-[#37352F]"
                placeholder="Tu nombre de usuario"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#787774] mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[#E9E9E7] rounded-md focus:ring-1 focus:ring-[#37352F] focus:border-[#37352F] outline-none transition-colors pr-10 text-sm text-[#37352F]"
                  placeholder="Tu contraseña"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9A97] hover:text-[#787774]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#37352F] text-white py-2.5 rounded-md text-sm font-medium hover:bg-[#2F2D2B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          <div className="flex justify-center mt-4">
            <Link
              to="/forgot-password"
              className="text-xs text-[#787774] hover:text-[#37352F] transition-colors underline underline-offset-2"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <p className="text-center text-xs text-[#9B9A97] mt-3">
            Tu cuenta es asignada por tu institución educativa.
          </p>
        </div>

        {/* Credenciales demo — solo en modo demo */}
        <div className="mt-4 bg-white border border-[#E9E9E7] rounded-md p-4">
          <p className="text-xs font-semibold text-[#787774] uppercase tracking-wider mb-3">
            🔑 Accesos de demostración
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Estudiante',     user: 'demo',          pass: 'demo1234',          color: 'bg-blue-50 border-blue-200 text-blue-700' },
              { label: 'Profesor',       user: 'profesor',      pass: 'profesor1234',      color: 'bg-green-50 border-green-200 text-green-700' },
              { label: 'Admin',          user: 'admin',         pass: 'admin1234',         color: 'bg-orange-50 border-orange-200 text-orange-700' },
              { label: 'Super Profesor', user: 'superprofesor', pass: 'superprofesor1234', color: 'bg-purple-50 border-purple-200 text-purple-700' },
            ].map(({ label, user: u, pass, color }) => (
              <button
                key={u}
                type="button"
                onClick={() => setForm({ username: u, password: pass })}
                className={`text-left p-2.5 rounded border text-xs font-medium transition-all hover:opacity-80 ${color}`}
              >
                <span className="block font-semibold mb-0.5">{label}</span>
                <span className="font-mono opacity-75">{u}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#9B9A97] mt-2 text-center">
            Haz clic en un rol para rellenar las credenciales automáticamente.
          </p>
        </div>

      </div>
    </div>
  );
}
