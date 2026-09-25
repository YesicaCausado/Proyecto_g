import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import NeuronAvatar from '../../components/NeuronAvatar';
import { COMPETENCIES } from '../../data/competencies';
import api from '../../services/api';
import { Bot, Loader2 } from 'lucide-react';

interface SharedBot {
  id: number;
  name: string;
  description: string;
  subject: string;
  creator_name: string;
  classroom_name: string | null;
  is_required: boolean;
  source: string;
}

export default function BotsPage() {
  const SKILLS = COMPETENCIES;
  const [customBots, setCustomBots] = useState<SharedBot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBots = async () => {
      try {
        const res = await api.get('/bots/shared-with-me');
        setCustomBots(res.data?.bots || []);
      } catch (err) {
        console.error('Error fetching shared bots:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBots();
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="pb-5 mb-6 border-b border-[#E9E9E7]">
        <div className="flex items-center gap-4 bg-[#1a1a1a] rounded-md p-5 mb-6 text-white">
          <NeuronAvatar size={52} online variant="gradient" />
          <div>
            <p className="text-[#9B9A97] text-[10px] uppercase tracking-widest font-semibold mb-0.5">
              Tu asistente inteligente
            </p>
            <h2 className="text-base font-bold text-white leading-tight">
              Neuron <span className="text-[#60C8FF] font-normal text-sm">· NeuroLearn AI</span>
            </h2>
            <p className="text-[#787774] text-xs mt-1">
              Selecciona una habilidad o un bot personalizado y empieza a practicar
            </p>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-[#37352F]">Competencias Generales</h1>
        <p className="text-[#787774] text-sm mt-1">
          5 competencias clave para el Saber 11. Selecciona una para practicar con Neuron.
        </p>
      </div>

      <div className="space-y-3 mb-10">
        {SKILLS.map((skill) => (
          <Link
            key={skill.key}
            to={`/chat/${skill.slug}`}
            className="flex items-start gap-4 bg-white border border-[#E9E9E7] rounded-md p-5 hover:border-[#9B9A97] transition-colors group"
          >
            <div className={`w-12 h-12 ${skill.bg} border border-[#E9E9E7] rounded-md flex items-center justify-center text-2xl flex-shrink-0`}>
              {skill.iconEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-[#37352F] text-[15px] group-hover:text-[#37352F] transition-colors">
                {skill.name}
              </h3>
              <p className="text-sm text-[#787774] mt-0.5">{skill.desc}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {skill.topics.map((topic) => (
                  <span
                    key={topic}
                    className="text-xs bg-[#F7F6F3] text-[#787774] px-2.5 py-1 rounded-md border border-[#E9E9E7]"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
            <div className="hidden sm:flex items-center text-[#9B9A97] opacity-0 group-hover:opacity-100 transition-opacity text-sm">
              Practicar →
            </div>
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-[#9B9A97]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando bots de tus profesores...
        </div>
      ) : customBots.length > 0 ? (
        <>
          <div className="pb-3 mb-4 border-b border-[#E9E9E7]">
            <h2 className="text-lg font-semibold text-[#37352F]">Bots de tus Profesores</h2>
            <p className="text-[#787774] text-sm mt-1">
              Asistentes creados por tus profesores para clases específicas.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customBots.map((bot) => (
              <Link
                key={bot.id}
                to={`/chat/custom?bot_id=${bot.id}&bot_name=${encodeURIComponent(bot.name)}`}
                className="flex flex-col bg-white border border-[#E9E9E7] rounded-md p-5 hover:border-[#9B9A97] transition-colors group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-[#EEF3FD] border border-[#C5D9F7] rounded-md flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-[#2E6FDB]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#37352F] text-[15px] truncate">{bot.name}</h3>
                    <p className="text-[11px] text-[#9B9A97] truncate">{bot.subject}</p>
                  </div>
                </div>
                <p className="text-sm text-[#787774] flex-1 mb-4 line-clamp-2">
                  {bot.description || 'Sin descripción'}
                </p>
                <div className="flex items-center justify-between text-xs mt-auto pt-3 border-t border-[#F7F6F3]">
                  <span className="text-[#9B9A97]">Por: {bot.creator_name || 'Profesor'}</span>
                  {bot.classroom_name && (
                    <span className="bg-[#F7F6F3] text-[#787774] px-2 py-0.5 rounded-md border border-[#E9E9E7] truncate max-w-[120px]">
                      {bot.classroom_name}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
