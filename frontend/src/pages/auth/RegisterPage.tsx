import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Brain, Eye, EyeOff, Loader2, GraduationCap, BookOpenCheck } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'estudiante' as 'estudiante' | 'profesor',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#37352F] rounded-md flex items-center justify-center mx-auto mb-4">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-[#37352F]">Crear Cuenta</h1>
          <p className="text-[#787774] text-sm mt-1">Únete a NeuroLearn AI</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-md border border-[#E9E9E7] p-8">
          {error && (
            <div className="bg-[#FDEEEE] border border-[#F4BDBD] text-[#E03E3E] text-sm rounded-md px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role selector */}
            <div>
              <label className="block text-xs font-medium text-[#787774] mb-2">Soy...</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: 'estudiante' })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-md border-2 transition-all text-sm ${
                    form.role === 'estudiante'
                      ? 'border-[#37352F] bg-[#F7F6F3] text-[#37352F]'
                      : 'border-[#E9E9E7] hover:border-[#9B9A97] text-[#787774]'
                  }`}
                >
                  <GraduationCap className="w-5 h-5" />
                  <span className="font-medium">Estudiante</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: 'profesor' })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-md border-2 transition-all text-sm ${
                    form.role === 'profesor'
                      ? 'border-[#37352F] bg-[#F7F6F3] text-[#37352F]'
                      : 'border-[#E9E9E7] hover:border-[#9B9A97] text-[#787774]'
                  }`}
                >
                  <BookOpenCheck className="w-5 h-5" />
                  <span className="font-medium">Profesor</span>
                </button>
              </div>
            </div>

            {[
              { id: 'full_name', label: 'Nombre completo', type: 'text', placeholder: 'Tu nombre completo', required: false },
              { id: 'username',  label: 'Usuario',         type: 'text', placeholder: 'Elige un nombre de usuario', required: true, minLength: 3 },
              { id: 'email',     label: 'Correo electrónico', type: 'email', placeholder: 'tu@correo.com', required: true },
            ].map((f) => (
              <div key={f.id}>
                <label className="block text-xs font-medium text-[#787774] mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.id as keyof typeof form] as string}
                  onChange={(e) => setForm({ ...form, [f.id]: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[#E9E9E7] rounded-md focus:ring-1 focus:ring-[#37352F] focus:border-[#37352F] outline-none text-sm text-[#37352F]"
                  placeholder={f.placeholder}
                  required={f.required}
                  minLength={f.minLength}
                />
              </div>
            ))}

            <div>
              <label className="block text-xs font-medium text-[#787774] mb-1">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[#E9E9E7] rounded-md focus:ring-1 focus:ring-[#37352F] focus:border-[#37352F] outline-none transition-colors pr-10 text-sm text-[#37352F]"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
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
                  Creando cuenta...
                </>
              ) : (
                'Crear cuenta'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-[#787774] mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-[#37352F] hover:underline font-medium">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
