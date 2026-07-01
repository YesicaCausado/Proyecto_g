import { useState } from 'react';
import { Bot, Search, Edit3, Trash2, Copy, PowerOff, BarChart2, Globe, Lock, FileText, MessageSquare } from 'lucide-react';

const MOCK_BOTS = [
  { id: 1, name: 'MateBot 8A',     teacher: 'Carlos Martínez', group: 'Matemáticas 8A', subject: 'Matemáticas', docs: 12, queries: 342, status: 'activo',   visibility: 'privado',  created: '2026-02-10' },
  { id: 2, name: 'CienciasBot',    teacher: 'Laura González',  group: 'Ciencias 9B',    subject: 'Ciencias',    docs:  8, queries: 218, status: 'activo',   visibility: 'publico',  created: '2026-02-15' },
  { id: 3, name: 'LenguajeAI',     teacher: 'Ana Torres',      group: 'Lenguaje 7C',    subject: 'Lenguaje',    docs: 15, queries: 189, status: 'activo',   visibility: 'privado',  created: '2026-03-01' },
  { id: 4, name: 'HistoriaBot',    teacher: 'Pedro Ramírez',   group: 'Historia 10A',   subject: 'Sociales',    docs:  6, queries: 145, status: 'inactivo', visibility: 'privado',  created: '2026-03-10' },
  { id: 5, name: 'FísicaExpert',   teacher: 'María López',     group: 'Física 11B',     subject: 'Física',      docs: 20, queries: 401, status: 'activo',   visibility: 'publico',  created: '2026-01-20' },
  { id: 6, name: 'InglésHelper',   teacher: 'Juan Herrera',    group: 'Inglés 6A',      subject: 'Inglés',      docs:  9, queries:  98, status: 'inactivo', visibility: 'privado',  created: '2026-04-05' },
  { id: 7, name: 'TecnoBot Pro',   teacher: 'Sofía Castro',    group: 'Tecnología 8B',  subject: 'Tecnología',  docs: 18, queries: 520, status: 'activo',   visibility: 'publico',  created: '2026-01-15' },
];

type Filter = 'todos' | 'activo' | 'inactivo';

export default function NeuroBots() {
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState<Filter>('todos');
  const [bots, setBots]               = useState(MOCK_BOTS);
  const [toast, setToast]             = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`¿Eliminar el NeuroBots "${name}"? Esta acción no se puede deshacer.`)) {
      setBots(prev => prev.filter(b => b.id !== id));
      showToast(`NeuroBots "${name}" eliminado.`);
    }
  };

  const handleDuplicate = (bot: typeof MOCK_BOTS[0]) => {
    const copy = { ...bot, id: Date.now(), name: `${bot.name} (copia)`, queries: 0, created: new Date().toISOString().slice(0,10) };
    setBots(prev => [copy, ...prev]);
    showToast(`NeuroBots "${bot.name}" duplicado.`);
  };

  const handleToggle = (id: number) => {
    setBots(prev => prev.map(b => b.id === id ? { ...b, status: b.status === 'activo' ? 'inactivo' : 'activo' } : b));
    const b = bots.find(b => b.id === id);
    showToast(`NeuroBots "${b?.name}" ${b?.status === 'activo' ? 'desactivado' : 'activado'}.`);
  };

  const filtered = bots.filter(b =>
    (filter === 'todos' || b.status === filter) &&
    (b.name.toLowerCase().includes(search.toLowerCase()) ||
     b.teacher.toLowerCase().includes(search.toLowerCase()) ||
     b.subject.toLowerCase().includes(search.toLowerCase()))
  );

  const totalQueries = bots.reduce((s, b) => s + b.queries, 0);
  const activeBots   = bots.filter(b => b.status === 'activo').length;
  const publicBots   = bots.filter(b => b.visibility === 'publico').length;

  return (
    <div className="space-y-6">

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#37352F] text-white px-4 py-2.5 rounded-lg text-sm shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400" /> {toast}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Bot,          label: 'NeuroBots activos', value: activeBots,       color: 'text-[#6940A5]', bg: 'bg-purple-50' },
          { icon: MessageSquare,label: 'Consultas totales',  value: totalQueries,     color: 'text-[#0B6E99]', bg: 'bg-blue-50' },
          { icon: Globe,        label: 'Bots públicos',     value: publicBots,       color: 'text-[#0F7B6C]', bg: 'bg-emerald-50' },
          { icon: FileText,     label: 'Total documentos',  value: bots.reduce((s,b)=>s+b.docs,0), color: 'text-[#D9730D]', bg: 'bg-orange-50' },
        ].map((k,i) => (
          <div key={i} className="bg-white border border-[#E9E9E7] rounded-lg p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-md ${k.bg} flex items-center justify-center flex-shrink-0`}>
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <div>
              <p className="text-xs text-[#787774]">{k.label}</p>
              <p className="text-xl font-bold text-[#191919]">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEADAB]" />
          <input type="text" placeholder="Buscar bot, profesor o materia..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] outline-none bg-white" />
        </div>
        <div className="flex gap-2">
          {(['todos','activo','inactivo'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs rounded-md border font-medium transition-colors capitalize ${filter===f ? 'bg-[#37352F] text-white border-[#37352F]' : 'bg-white text-[#787774] border-[#E9E9E7] hover:bg-[#F7F6F3]'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
            <tr>
              {['NeuroBots','Profesor','Materia','Docs','Consultas','Visibilidad','Estado','Acciones'].map(h => (
                <th key={h} className={`px-4 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider ${h==='Acciones'?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E9E9E7]">
            {filtered.map(bot => (
              <tr key={bot.id} className="hover:bg-[#F7F6F3]/50 transition-colors">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-purple-50 rounded-md flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-[#6940A5]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#191919] text-sm">{bot.name}</p>
                      <p className="text-[10px] text-[#787774]">{bot.group}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#F7F6F3] border border-[#E9E9E7] flex items-center justify-center text-[10px] font-bold text-[#787774]">
                      {bot.teacher.charAt(0)}
                    </div>
                    <span className="text-sm text-[#37352F]">{bot.teacher}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-sm text-[#787774]">{bot.subject}</td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-[#37352F]">
                    <FileText className="w-3.5 h-3.5 text-[#787774]" /> {bot.docs}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-[#37352F]">
                    <MessageSquare className="w-3.5 h-3.5 text-[#787774]" /> {bot.queries.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${bot.visibility === 'publico' ? 'bg-[#E5F3FF] text-[#0B6E99]' : 'bg-[#F7F6F3] text-[#787774]'}`}>
                    {bot.visibility === 'publico' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    {bot.visibility}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${bot.status === 'activo' ? 'bg-[#EEF8F6] text-[#0F7B6C]' : 'bg-[#F7F6F3] text-[#787774]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${bot.status === 'activo' ? 'bg-[#0F7B6C]' : 'bg-[#AEADAB]'}`} />
                    {bot.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => showToast(`Ver estadísticas de "${bot.name}" (próximamente)`)} title="Ver estadísticas" className="p-1.5 rounded hover:bg-purple-50 text-[#787774] hover:text-[#6940A5] transition-colors"><BarChart2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => showToast(`Editar "${bot.name}" (próximamente)`)} title="Editar" className="p-1.5 rounded hover:bg-[#F7F6F3] text-[#787774] hover:text-[#37352F] transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDuplicate(bot)} title="Duplicar" className="p-1.5 rounded hover:bg-[#E5F3FF] text-[#787774] hover:text-[#0B6E99] transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleToggle(bot.id)} title={bot.status === 'activo' ? 'Desactivar' : 'Activar'} className="p-1.5 rounded hover:bg-[#FCF6E5] text-[#787774] hover:text-[#D9730D] transition-colors"><PowerOff className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(bot.id, bot.name)} title="Eliminar" className="p-1.5 rounded hover:bg-[#FDEEEE] text-[#787774] hover:text-[#E03E3E] transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[#787774]"><Bot className="w-10 h-10 mx-auto mb-3 opacity-20" /><p>No se encontraron NeuroBots</p></div>
        )}
        <div className="px-4 py-3 border-t border-[#E9E9E7] bg-[#F7F6F3] flex justify-between items-center">
          <p className="text-xs text-[#787774]">Mostrando {filtered.length} de {bots.length} NeuroBots</p>
          <span className="text-[10px] bg-[#FCF6E5] text-[#D9730D] border border-[#EDD88A] px-2 py-0.5 rounded font-semibold">DEMO</span>
        </div>
      </div>
    </div>
  );
}
