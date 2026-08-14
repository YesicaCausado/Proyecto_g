import { useEffect, useMemo, useState } from 'react';
import { Bot, Globe, Lock, ShieldCheck, RefreshCw, ToggleLeft, ToggleRight, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../../services/api';

interface AdminBot {
  id: number;
  name: string;
  description: string;
  category: string;
  creator_id: number | null;
  creator_name: string;
  is_public: boolean;
  is_active: boolean;
  total_users: number;
  avg_rating: number;
  total_sessions: number;
  created_at: string | null;
}

interface PretrainedBot {
  filename: string;
  name: string;
  description: string;
  category: string;
  personality: string;
  steps: number;
  warnings: number;
  rules: number;
  tips: number;
  scenarios: number;
  faq: number;
  total_items: number;
  saved_at: string;
  is_public: boolean;
}

export default function BotManagement() {
  const [bots, setBots] = useState<AdminBot[]>([]);
  const [pretrained, setPretrained] = useState<PretrainedBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'public' | 'private' | 'active' | 'inactive'>('all');

  const fetchBotData = async () => {
    try {
      setLoading(true);
      const [botsRes, pretrainedRes] = await Promise.all([
        api.get('/admin/bots'),
        api.get('/admin/bots/pretrained'),
      ]);
      setBots(botsRes.data.bots ?? []);
      setPretrained(pretrainedRes.data.bots ?? []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudieron cargar los bots del sistema.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBotData(); }, []);

  const filteredBots = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bots.filter((bot) => {
      const matchesSearch = !q || [bot.name, bot.description, bot.category, bot.creator_name].join(' ').toLowerCase().includes(q);
      const matchesFilter = (() => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'public') return bot.is_public;
        if (statusFilter === 'private') return !bot.is_public;
        if (statusFilter === 'active') return bot.is_active;
        if (statusFilter === 'inactive') return !bot.is_active;
        return true;
      })();
      return matchesSearch && matchesFilter;
    });
  }, [bots, search, statusFilter]);

  const toggleBot = async (bot: AdminBot) => {
    try {
      await api.patch(`/admin/bots/${bot.id}`, {
        is_public: !bot.is_public,
        is_active: bot.is_active,
      });
      setBots((prev) => prev.map((b) => b.id === bot.id ? { ...b, is_public: !b.is_public } : b));
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo cambiar la visibilidad del bot.');
    }
  };

  const toggleActive = async (bot: AdminBot) => {
    try {
      await api.patch(`/admin/bots/${bot.id}`, {
        is_public: bot.is_public,
        is_active: !bot.is_active,
      });
      setBots((prev) => prev.map((b) => b.id === bot.id ? { ...b, is_active: !b.is_active } : b));
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo cambiar el estado del bot.');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#191919] flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#2E6FDB]" /> Moderación de Bots
          </h1>
          <p className="text-sm text-[#787774] mt-1">Control global de bots públicos, privados y pre-entrenados.</p>
        </div>
        <button
          onClick={fetchBotData}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-[#E9E9E7] rounded-md hover:bg-[#F7F6F3] text-[#37352F]"
        >
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {error && (
        <div className="bg-[#FDECEA] border border-[#D44C47]/30 text-[#D44C47] rounded-md p-3 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="bg-white border border-[#E9E9E7] rounded-lg p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9A97]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar bots por nombre, tema o creador..."
              className="w-full pl-9 pr-4 py-2.5 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#2E6FDB] outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2.5 border border-[#E9E9E7] rounded-md text-sm bg-white"
          >
            <option value="all">Todos</option>
            <option value="public">Públicos</option>
            <option value="private">Privados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-[#787774]">Cargando bots…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F6F3]">
                <tr>
                  <th className="px-4 py-3 text-left">Bot</th>
                  <th className="px-4 py-3 text-left">Tema</th>
                  <th className="px-4 py-3 text-center">Visibilidad</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Uso</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9E9E7]">
                {filteredBots.map((bot) => (
                  <tr key={bot.id} className="hover:bg-[#F7F6F3]/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#EEF3FD] rounded-lg flex items-center justify-center">
                          <Bot className="w-4 h-4 text-[#2E6FDB]" />
                        </div>
                        <div>
                          <div className="font-medium text-[#191919]">{bot.name}</div>
                          <div className="text-xs text-[#787774]">{bot.creator_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#37352F]">{bot.category}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bot.is_public ? 'bg-[#EEF7F4] text-[#0F7B6C]' : 'bg-[#F7F6F3] text-[#787774]'}`}>
                        {bot.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {bot.is_public ? 'Público' : 'Privado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bot.is_active ? 'bg-[#EEF7F4] text-[#0F7B6C]' : 'bg-[#FDECEA] text-[#D44C47]'}`}>
                        {bot.is_active ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {bot.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-[#787774]">
                      {bot.total_sessions} sesiones
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => toggleBot(bot)} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border border-[#E9E9E7] hover:bg-[#F7F6F3]">
                          {bot.is_public ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />} {bot.is_public ? 'Privatizar' : 'Publicar'}
                        </button>
                        <button onClick={() => toggleActive(bot)} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border border-[#E9E9E7] hover:bg-[#F7F6F3]">
                          {bot.is_active ? <ToggleLeft className="w-3 h-3" /> : <ToggleRight className="w-3 h-3" />} {bot.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredBots.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#787774]">No hay bots que coincidan con el filtro actual.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-[#E9E9E7] rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-[#6940A5]" />
          <h2 className="font-semibold text-[#191919]">Bots pre-entrenados</h2>
        </div>

        {pretrained.length === 0 ? (
          <div className="text-sm text-[#787774] py-4">No hay bots pre-entrenados disponibles.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pretrained.map((bot) => (
              <div key={bot.filename} className="border border-[#E9E9E7] rounded-md p-3 bg-[#F7F6F3]/40">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[#191919] text-sm">{bot.name}</div>
                    <div className="text-[11px] text-[#787774] mt-0.5">{bot.category}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${bot.is_public ? 'bg-[#EEF7F4] text-[#0F7B6C]' : 'bg-[#F7F6F3] text-[#787774]'}`}>
                    {bot.is_public ? 'Público' : 'Base'}
                  </span>
                </div>
                <p className="text-xs text-[#787774] mt-2 line-clamp-3">{bot.description || 'Bot de conocimiento base sin descripción.'}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-[#787774]">
                  <span>{bot.total_items} items</span>
                  <span>{bot.steps} pasos</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
