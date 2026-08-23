import { useEffect, useState } from 'react';
import api from '../services/api';

interface Racha {
  id: number;
  start_date: string;
  end_date: string;
  days: number;
  total_sessions: number;
  streak_type: string;
}

export default function ProgressRacha({ userId }: { userId: number }) {
  const [racha, setRacha] = useState<Racha | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRacha();
  }, [userId]);

  const fetchRacha = async () => {
    try {
      const response = await api.get(`/student/racha/${userId}`);
      setRacha(response.data);
    } catch (error) {
      console.error('Error cargando racha:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStreakEmoji = (days: number) => {
    if (days >= 30) return '🔥🔥🔥';
    if (days >= 14) return '🔥🔥';
    if (days >= 7) return '🔥';
    return '';
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#ccc' }}>
        Cargando racha...
      </div>
    );
  }

  if (!racha) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#ccc' }}>
        No hay datos de racha disponibles
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '16px',
      padding: '24px',
      color: 'white'
    }}>
      <h2 style={{ marginBottom: '16px', fontSize: '24px' }}>
        Tu Racha de Aprendizaje
      </h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '14px', opacity: 0.8 }}>Días consecutivos</h3>
          <p style={{ margin: 0, fontSize: '36px', fontWeight: 'bold' }}>
            {racha.days}
          </p>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>
            {getStreakEmoji(racha.days)}
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '14px', opacity: 0.8 }}>Sesiones totales</h3>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
            {racha.total_sessions}
          </p>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>
            en esta racha
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '14px', opacity: 0.8 }}>Tipo de racha</h3>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
            {racha.streak_type}
          </p>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>
            Aprendizaje consistente
          </p>
        </div>
      </div>

      <div style={{ 
        background: 'rgba(255,255,255,0.1)', 
        padding: '16px', 
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '14px', opacity: 0.8 }}>
          Inicio de racha
        </h3>
        <p style={{ margin: 0, fontSize: '14px' }}>
          {new Date(racha.start_date).toLocaleDateString('es-CO', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </p>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.1)',
        padding: '16px',
        borderRadius: '8px'
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '14px', opacity: 0.8 }}>
          Fin de racha
        </h3>
        <p style={{ margin: 0, fontSize: '14px' }}>
          {new Date(racha.end_date).toLocaleDateString('es-CO', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </p>
      </div>
    </div>
  );
}