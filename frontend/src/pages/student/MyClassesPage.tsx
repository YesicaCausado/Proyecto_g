import { useState } from 'react';
import api from '../../services/api';
import { DEMO_MODE } from '../../services/demoChat';
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
    if (DEMO_MODE) { setFetched(true); return; }
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
    <div className="p-6 md:p-8 max-w-4xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="pb-5 mb-6 border-b border-[#E9E9E7]">
        <h1 className="text-xl font-semibold text-[#37352F]">Mis Clases</h1>
      </div>

      {/* Join by code */}
      <div className="bg-white border border-[#E9E9E7] rounded-md p-5 mb-5">
        <h2 className="font-medium text-[#37352F] text-sm mb-3 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#787774]" />
          Unirse a una clase
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="Código de invitación (8 caracteres)"
            maxLength={8}
            className="flex-1 px-4 py-2.5 border border-[#E9E9E7] rounded-md focus:ring-1 focus:ring-[#37352F] focus:border-[#37352F] outline-none uppercase tracking-widest font-mono text-sm text-[#37352F]"
          />
          <button
            onClick={joinClass}
            disabled={joinLoading || inviteCode.length < 8}
            className="px-5 py-2.5 bg-[#37352F] text-white rounded-md text-sm font-medium hover:bg-[#2F2D2B] disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {joinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Unirse
          </button>
        </div>
        {message && <p className="text-[#0F7B6C] text-sm mt-2">{message}</p>}
        {error && <p className="text-[#E03E3E] text-sm mt-2">{error}</p>}
      </div>

      {/* Class list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[#9B9A97]" />
        </div>
      ) : classrooms.length === 0 ? (
        <div className="text-center py-12 text-[#787774]">
          <Users className="w-10 h-10 mx-auto mb-3 text-[#E9E9E7]" />
          <p className="font-medium text-sm">No estás inscrito en ninguna clase</p>
          <p className="text-xs mt-1 text-[#9B9A97]">Pídele a tu profesor el código de invitación</p>
        </div>
      ) : (
        <div className="space-y-3">
          {classrooms.map((c) => (
            <div key={c.id} className="bg-white border border-[#E9E9E7] rounded-md p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-[#37352F] text-sm">{c.name}</h3>
                  <p className="text-xs text-[#787774] mt-0.5">{c.subject} • {c.grade || 'Sin grado'}</p>
                  {c.description && <p className="text-xs text-[#9B9A97] mt-1">{c.description}</p>}
                </div>
                <div className="flex items-center gap-1 text-xs text-[#9B9A97]">
                  <Users className="w-3.5 h-3.5" />
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
