import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function CreateClassroomPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    description: '',
    subject: '',
    grade: '',
    max_students: 40,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const subjects = [
    'Matemáticas',
    'Lenguaje',
    'Inglés',
    'Ciencias Naturales',
    'Ciencias Sociales',
    'Competencias Ciudadanas',
    'Razonamiento Cuantitativo',
    'Lectura Crítica',
    'Otra',
  ];

  const grades = ['6°', '7°', '8°', '9°', '10°', '11°'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/classrooms/', form);
      navigate(`/classrooms/${data.id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || 'Error al crear la clase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-xs text-[#787774] hover:text-[#37352F] mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver
      </button>

      <h1 className="text-xl font-semibold text-[#37352F] mb-6">Crear Nueva Clase</h1>

      <div className="bg-white border border-[#E9E9E7] rounded-md p-6">
        {error && (
          <div className="bg-[#FDEEEE] border border-[#F4BDBD] text-[#E03E3E] text-sm rounded-md px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#787774] mb-1">
              Nombre de la clase *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-[#E9E9E7] rounded-md focus:ring-1 focus:ring-[#37352F] focus:border-[#37352F] outline-none text-sm text-[#37352F]"
              placeholder="Ej: Matemáticas 11-A"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#787774] mb-1">
              Materia *
            </label>
            <select
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full px-4 py-2.5 border border-[#E9E9E7] rounded-md focus:ring-1 focus:ring-[#37352F] focus:border-[#37352F] outline-none text-sm text-[#37352F]"
              required
            >
              <option value="">Selecciona una materia</option>
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#787774] mb-1">
              Grado
            </label>
            <select
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: e.target.value })}
              className="w-full px-4 py-2.5 border border-[#E9E9E7] rounded-md focus:ring-1 focus:ring-[#37352F] focus:border-[#37352F] outline-none text-sm text-[#37352F]"
            >
              <option value="">Selecciona un grado</option>
              {grades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#787774] mb-1">
              Descripción
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-[#E9E9E7] rounded-md focus:ring-1 focus:ring-[#37352F] focus:border-[#37352F] outline-none resize-none text-sm text-[#37352F]"
              rows={3}
              placeholder="Descripción opcional de la clase"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#787774] mb-1">
              Máximo de estudiantes
            </label>
            <input
              type="number"
              value={form.max_students}
              onChange={(e) => setForm({ ...form, max_students: parseInt(e.target.value) || 40 })}
              min={1}
              max={100}
              className="w-full px-4 py-2.5 border border-[#E9E9E7] rounded-md focus:ring-1 focus:ring-[#37352F] focus:border-[#37352F] outline-none text-sm text-[#37352F]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#37352F] text-white py-2.5 rounded-md text-sm font-medium hover:bg-[#2F2D2B] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creando...
              </>
            ) : (
              'Crear Clase'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
