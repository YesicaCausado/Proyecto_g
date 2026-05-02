import { useState } from 'react';
import api from '../../services/api';
import type { Classroom } from '../../types';
import { Users, KeyRound, Loader2, CheckCircle } from 'lucide-react';

export default function MyClassesPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState(false);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/classrooms/my-enrolled');
      setClassrooms(data.classrooms || []);
    } catch {
      setClassrooms([]);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  // Fetch on first render
  if (!fetched && !loading) fetchClasses();

  const joinClass = async () => {
    if (!inviteCode.trim()) return;
    setJoinLoading(true);
    setError('');
    setMessage('');
    try {
      await api.post('/classrooms/join', { invite_code: inviteCode.trim() });
      setMessage('¡Te has inscrito exitosamente!');
      setInviteCode('');
      fetchClasses();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || 'No se pudo unir a la clase');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">📝 Mis Clases</h1>

      {/* Join by code */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary-600" />
          Unirse a una clase
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="Código de invitación (8 caracteres)"
            maxLength={8}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none uppercase tracking-widest font-mono"
          />
          <button
            onClick={joinClass}
            disabled={joinLoading || inviteCode.length < 8}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
          >
            {joinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Unirse
          </button>
        </div>
        {message && <p className="text-green-600 text-sm mt-2">{message}</p>}
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>

      {/* Class list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        </div>
      ) : classrooms.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No estás inscrito en ninguna clase</p>
          <p className="text-sm mt-1">Pídele a tu profesor el código de invitación</p>
        </div>
      ) : (
        <div className="space-y-3">
          {classrooms.map((c) => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{c.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{c.subject} • {c.grade || 'Sin grado'}</p>
                  {c.description && <p className="text-sm text-gray-400 mt-1">{c.description}</p>}
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Users className="w-4 h-4" />
                  {c.student_count}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
