import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Users, GraduationCap, BookOpen, User, Paperclip, Clock, CheckCheck, Plus, Trash2, X, Download } from 'lucide-react';
import api from '../../../services/api';
import Messaging from '../../../components/Messaging';

type Recipient = 'institucional' | 'profesores' | 'estudiantes' | 'grado';
type View = 'compose' | 'sent' | 'chat';

interface SentMsg {
  id: number; subject: string; to: string; date: string;
  reads: number; total: number; sender: string;
  attachment?: { name: string; mime: string; size: number } | null;
}

const RECIPIENT_OPTIONS: { value: Recipient; label: string; icon: any }[] = [
  { value: 'institucional', label: 'Toda la institución', icon: Users },
  { value: 'profesores',    label: 'Solo profesores',     icon: User },
  { value: 'estudiantes',   label: 'Solo estudiantes',    icon: GraduationCap },
  { value: 'grado',         label: 'Por grado',           icon: BookOpen },
];

export default function MensajeriaTab() {
  const [view, setView]           = useState<View>('compose');
  const [recipient, setRecipient] = useState<Recipient>('institucional');
  const [grade, setGrade]         = useState('');
  const [subject, setSubject]     = useState('');
  const [body, setBody]           = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [sent, setSent]           = useState<SentMsg[]>([]);
  const [sending, setSending]     = useState(false);
  const [success, setSuccess]     = useState('');
  const [teacherCount, setTeacherCount] = useState<number | null>(null);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [grades, setGrades]             = useState<string[]>([]);

  useEffect(() => {
    api.get('/super/broadcasts')
      .then(r => setSent(r.data.broadcasts ?? []))
      .catch(() => setSent([]));
  }, []);

  useEffect(() => {
    api.get('/super/teachers').then(r => setTeacherCount(Array.isArray(r.data) ? r.data.length : null)).catch(() => {});
    api.get('/super/students').then(r => {
      const arr = Array.isArray(r.data) ? r.data : [];
      setStudentCount(arr.length);
      setGrades([...new Set(arr.map((s: any) => (s.grade || '').trim()).filter(Boolean))].sort());
    }).catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const res = await api.post('/super/broadcasts', {
        subject,
        body,
        recipient_type: recipient,
        grade: recipient === 'grado' ? grade : undefined,
        scheduled_at: scheduleDate || undefined,
      });
      setSent(prev => [res.data, ...prev]);
      setSubject(''); setBody(''); setScheduleDate('');
      setSuccess('¡Mensaje enviado exitosamente!');
      setTimeout(() => setSuccess(''), 4000);
      setView('sent');
    } catch {
      setSuccess('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F7F6F3] p-1 rounded-md w-fit border border-[#E9E9E7]">
        {[{ id: 'compose', label: 'Nuevo mensaje', icon: Plus }, { id: 'sent', label: 'Enviados', icon: Clock }, { id: 'chat', label: 'Chat directo', icon: MessageSquare }].map(t => (
          <button key={t.id} onClick={() => setView(t.id as View)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors ${view===t.id ? 'bg-white text-[#191919] shadow-sm border border-[#E9E9E7]' : 'text-[#787774] hover:bg-white/50 hover:text-[#37352F]'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {success && (
        <div className="p-3 bg-[#EEF8F6] border border-[#A6DDD6] rounded-md flex items-center gap-2 text-sm text-[#0F7B6C] font-medium">
          <CheckCheck className="w-4 h-4" /> {success}
        </div>
      )}

      {view === 'compose' && (
        <div className="bg-white border border-[#E9E9E7] rounded-lg p-6 space-y-5 max-w-3xl">
          <h3 className="font-semibold text-[#191919] border-b border-[#E9E9E7] pb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#787774]" /> Redactar mensaje institucional
          </h3>

          <div>
            <label className="block text-xs font-semibold text-[#787774] mb-2 uppercase tracking-wide">Destinatarios</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {RECIPIENT_OPTIONS.map(opt => {
                const desc = opt.value === 'institucional' ? 'Profesores + estudiantes'
                  : opt.value === 'profesores' ? (teacherCount != null ? `${teacherCount} docentes activos` : '—')
                  : opt.value === 'estudiantes' ? (studentCount != null ? `${studentCount} estudiantes activos` : '—')
                  : grades.length > 0 ? `${grades.length} grados` : 'Sin grados registrados';
                return (
                <button key={opt.value} onClick={() => setRecipient(opt.value)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${recipient===opt.value ? 'border-[#0066FF] bg-blue-50 text-[#0066FF]' : 'border-[#E9E9E7] hover:border-[#AEADAB] text-[#787774]'}`}>
                  <opt.icon className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                    <p className="text-[10px] opacity-70">{desc}</p>
                  </div>
                </button>
                );
              })}
            </div>
            {recipient === 'grado' && (
              <select value={grade} onChange={e => setGrade(e.target.value)}
                className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none bg-white focus:ring-1 focus:ring-[#0066FF]">
                <option value="">Selecciona el grado</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            )}
            {grades.length === 0 && (
              <p className="text-[11px] text-[#AEADAB]">Aún no hay grados registrados en la plataforma.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">Asunto</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Escribe el asunto del mensaje..."
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none focus:ring-1 focus:ring-[#0066FF]" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">Mensaje</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
              placeholder="Escribe el contenido del mensaje institucional..."
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none focus:ring-1 focus:ring-[#0066FF] resize-none" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide flex items-center gap-1">
              <Clock className="w-3 h-3" /> Programar envío (opcional)
            </label>
            <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
              className="px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none focus:ring-1 focus:ring-[#0066FF] bg-white" />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#E9E9E7]">
            <button className="flex items-center gap-2 text-sm text-[#787774] hover:text-[#37352F] transition-colors">
              <Paperclip className="w-4 h-4" /> Adjuntar archivo
            </button>
            <div className="flex gap-2">
              <button onClick={() => { setSubject(''); setBody(''); }}
                className="px-4 py-2 border border-[#E9E9E7] rounded-md text-sm text-[#787774] hover:bg-[#F7F6F3] transition-colors">
                Limpiar
              </button>
              <button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-[#0066FF] text-white text-sm font-medium rounded-md hover:bg-[#0052CC] transition-colors shadow-sm disabled:opacity-50">
                {sending ? <><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Enviando...</> : <><Send className="w-4 h-4" /> {scheduleDate ? 'Programar envío' : 'Enviar ahora'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'sent' && (
        <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
              <tr>
                {['Asunto','Destinatarios','Fecha y hora','Lecturas','Acciones'].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider ${h==='Acciones'?'text-right':'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E9E7]">
              {sent.map(msg => {
                const pct = msg.total > 0 ? Math.round((msg.reads / msg.total) * 100) : 0;
                return (
                  <tr key={msg.id} className="hover:bg-[#F7F6F3]/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-[#191919]">{msg.subject}</p>
                      <p className="text-xs text-[#787774]">De: {msg.sender}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-xs bg-[#F7F6F3] px-2 py-0.5 rounded-full text-[#787774] border border-[#E9E9E7]">
                        <Users className="w-3 h-3" /> {msg.to}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#787774]">{msg.date}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#F7F6F3] rounded-full overflow-hidden w-20">
                          <div className="h-full bg-[#0066FF] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-[#787774] whitespace-nowrap">{msg.reads}/{msg.total}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button onClick={() => setSent(prev => prev.filter(m => m.id !== msg.id))}
                        className="p-1.5 rounded hover:bg-[#FDEEEE] text-[#787774] hover:text-[#E03E3E] transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sent.length === 0 && (
            <div className="text-center py-12 text-[#787774]"><MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" /><p>No hay mensajes enviados</p></div>
          )}
        </div>
      )}

      {view === 'chat' && (
        <Messaging
          accent="#6940A5"
          height="h-[580px]"
          emptyHint="Envía un mensaje directo a un profesor o estudiante"
        />
      )}
    </div>
  );
}