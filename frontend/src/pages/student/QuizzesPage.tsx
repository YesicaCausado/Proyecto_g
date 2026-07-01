import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, BookOpen, FlaskConical, Globe, Languages, ArrowLeft, Trophy, Clock, Target, RotateCcw, Play, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../services/api';

type Screen = 'select' | 'generating' | 'quiz' | 'results' | 'history';
type Difficulty = 'facil' | 'medio' | 'dificil';

interface Subject {
  id: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  text: string;
  border: string;
  btnColor: string;
}

interface QuizOption {
  text: string;
  letter: string;
}

interface QuizQuestion {
  id: number;
  question: string;
  options: QuizOption[];
  correct_answer: string;
  explanation: string;
}

interface QuizData {
  quiz_title: string;
  questions: QuizQuestion[];
}

interface QuizAnalysis {
  percentage: number;
  weak_concepts: string[];
  recommended_difficulty: string;
  adaptation_message: string;
}

interface QuizAnalysisResponse {
  analysis: QuizAnalysis;
  score: number;
  total: number;
  duration: number;
}

interface HistoryEntry {
  id: number;
  quiz_title: string;
  performance_score: number;
  questions_count: number;
  difficulty: string;
  user_score: number;
  created_at: string;
  recommended_difficulty?: string;
}

const SUBJECTS: Subject[] = [
  { id: 'matematicas', label: 'Matemáticas', desc: 'Álgebra, geometría y más', icon: Calculator, color: 'from-[#0B6E99] to-[#0B6E99]', bg: 'bg-[#E5F3FF]', text: 'text-[#0B6E99]', border: 'border-[#BFDFF0]', btnColor: 'bg-[#0B6E99] hover:bg-[#095E85]' },
  { id: 'lectura', label: 'Lectura Crítica', desc: 'Comprensión y análisis', icon: BookOpen, color: 'from-[#6940A5] to-[#6940A5]', bg: 'bg-[#F7F3FB]', text: 'text-[#6940A5]', border: 'border-[#D9CCE9]', btnColor: 'bg-[#6940A5] hover:bg-[#5A358F]' },
  { id: 'ciencias', label: 'Ciencias', desc: 'Física, química y biología', icon: FlaskConical, color: 'from-[#0F7B6C] to-[#0F7B6C]', bg: 'bg-[#EEF7F4]', text: 'text-[#0F7B6C]', border: 'border-[#B7DDD6]', btnColor: 'bg-[#0F7B6C] hover:bg-[#0A6459]' },
  { id: 'sociales', label: 'Sociales', desc: 'Historia y geografía', icon: Globe, color: 'from-[#D9730D] to-[#D9730D]', bg: 'bg-[#FDF4EC]', text: 'text-[#D9730D]', border: 'border-[#F2D2B7]', btnColor: 'bg-[#D9730D] hover:bg-[#B8600B]' },
  { id: 'ingles', label: 'Inglés', desc: 'Grammar, vocabulary & more', icon: Languages, color: 'from-[#AD1A72] to-[#AD1A72]', bg: 'bg-[#FCF0F7]', text: 'text-[#AD1A72]', border: 'border-[#EDB8D4]', btnColor: 'bg-[#AD1A72] hover:bg-[#8F1562]' },
];

const DIFF_LABELS: Record<Difficulty, string> = { facil: 'Fácil', medio: 'Medio', dificil: 'Difícil' };
const DIFF_COLORS: Record<Difficulty, string> = {
  facil: 'bg-[#EEF7F4] text-[#37352F] border-[#B7DDD6]',
  medio: 'bg-[#FCF6E5] text-[#DFAB01] border-[#EDD88A]',
  dificil: 'bg-[#FDEEEE] text-[#37352F] border-[#F4BDBD]',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function QuizzesPage() {
  const [screen, setScreen] = useState<Screen>('select');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('medio');
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [localScore, setLocalScore] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<QuizAnalysisResponse | null>(null);
  const [quizHistory, setQuizHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Timer
  useEffect(() => {
    if (screen !== 'quiz' || startTime === null) return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [screen, startTime]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/chat/quiz-history');
      setQuizHistory(res.data || []);
    } catch {
      // silently ignore
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleStartQuiz = async (subject: Subject) => {
    setSelectedSubject(subject);
    setIsLoading(true);
    setSelectedAnswers({});
    setIsSubmitted(false);
    setLocalScore(0);
    setAnalysisResult(null);
    setElapsedTime(0);
    setScreen('generating'); // ← switch immediately so results screen disappears at once
    try {
      const res = await api.post('/chat/generate-quiz', {
        topic: subject.label,
        num_questions: 10,
        difficulty,
      });

      // Normalize backend format → frontend format
      // Backend: options = string[], answer = full text string
      // Frontend: options = {letter, text}[], correct_answer = letter
      const rawData = res.data;
      const normalizedQuiz: QuizData = {
        quiz_title: rawData.quiz_title || subject.label,
        questions: (rawData.questions || []).map((q: any, qi: number) => {
          const rawOptions: string[] = Array.isArray(q.options) ? q.options : [];
          const options: QuizOption[] = rawOptions.map((opt: string, idx: number) => ({
            letter: String.fromCharCode(65 + idx), // A, B, C, D
            text: typeof opt === 'string' ? opt : (opt as any).text || String(opt),
          }));
          const correctText: string = q.answer || q.correct_answer || '';
          const correctOption = options.find(o => o.text === correctText);
          return {
            id: q.id ?? qi + 1,
            question: q.question || '',
            options,
            correct_answer: correctOption?.letter || options[0]?.letter || 'A',
            explanation: q.explanation || '',
          };
        }),
      };

      setQuiz(normalizedQuiz);
      setStartTime(Date.now());
      setScreen('quiz');
    } catch {
      setScreen('select');
      alert('Error al generar el quiz. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (questionId: number, answer: string) => {
    if (isSubmitted) return;
    setSelectedAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    setIsSubmitted(true);
    setIsAnalyzing(true);
    const duration = elapsedTime;
    let score = 0;
    quiz.questions.forEach(q => {
      if (selectedAnswers[q.id] === q.correct_answer) score++;
    });
    setLocalScore(score);
    try {
      const userAnswers = quiz.questions.map(q => ({
        question_id: q.id,
        selected_answer: selectedAnswers[q.id] || '',
        correct_answer: q.correct_answer,
        is_correct: selectedAnswers[q.id] === q.correct_answer,
      }));
      const res = await api.post('/chat/submit-quiz', {
        quiz_title: quiz.quiz_title,
        user_answers: userAnswers,
        duration,
      });
      setAnalysisResult(res.data);
    } catch {
      // show results without analysis
    } finally {
      setIsAnalyzing(false);
    }
    loadHistory(); // fire-and-forget, don't await
  };

  const handleRetryQuiz = () => {
    if (!selectedSubject) return;
    handleStartQuiz(selectedSubject);
  };

  const getResultIcon = (q: QuizQuestion) => {
    const answer = selectedAnswers[q.id];
    if (!answer) return <AlertCircle className="w-5 h-5 text-[#9B9A97]" />;
    return answer === q.correct_answer
      ? <CheckCircle className="w-5 h-5 text-[#0F7B6C]" />
      : <XCircle className="w-5 h-5 text-[#E03E3E]" />;
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const totalQuestions = quiz?.questions.length ?? 0;
  const pct = totalQuestions > 0 ? Math.round((localScore / totalQuestions) * 100) : 0;

  // ── GENERATING SCREEN ─────────────────────────────────────────
  if (screen === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-16 h-16 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-[#9B9A97] animate-spin" />
        </div>
        <div className="text-center">
          <h2 className="text-base font-semibold text-[#37352F] mb-1">Generando tu quiz…</h2>
          <p className="text-[#787774] text-sm">
            La IA está preparando 10 preguntas de <span className="font-medium text-[#37352F]">{selectedSubject?.label}</span>
          </p>
          <p className="text-[#9B9A97] text-xs mt-1">Nivel: {DIFF_LABELS[difficulty]}</p>
        </div>
      </div>
    );
  }

  // ── SELECT SCREEN ──────────────────────────────────────────────
  if (screen === 'select') {
    return (
      <div className="p-6 max-w-5xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="pb-5 mb-6 border-b border-[#E9E9E7] flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#37352F]">Desafíos</h1>
            <p className="text-[#787774] text-sm mt-1">Elige una materia, selecciona el nivel y pon a prueba tu conocimiento</p>
          </div>
          <button
            onClick={() => { setScreen('history'); loadHistory(); }}
            className="flex items-center gap-2 px-4 py-2 border border-[#E9E9E7] bg-white text-[#787774] hover:bg-[#F7F6F3] hover:text-[#37352F] rounded-md transition-colors text-sm font-medium"
          >
            <Trophy className="w-4 h-4" />
            Historial
          </button>
        </div>

        {/* Difficulty selector */}
        <div className="flex items-center gap-3 mb-6 p-4 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md">
          <span className="text-sm font-medium text-[#37352F]">Nivel de dificultad:</span>
          {(['facil', 'medio', 'dificil'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium border transition-all ${
                difficulty === d
                  ? 'bg-[#37352F] text-white border-[#37352F]'
                  : 'bg-white text-[#787774] border-[#E9E9E7] hover:border-[#9B9A97]'
              }`}
            >
              {DIFF_LABELS[d]}
            </button>
          ))}
        </div>

        {/* Subject cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SUBJECTS.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.id} className="bg-white border border-[#E9E9E7] rounded-md hover:border-[#9B9A97] transition-colors overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-[#787774]" />
                    </div>
                    <div>
                      <h3 className="font-medium text-[#37352F] text-sm">{s.label}</h3>
                      <p className="text-xs text-[#9B9A97] mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-md border ${DIFF_COLORS[difficulty]}`}>{DIFF_LABELS[difficulty]}</span>
                    <span className="text-xs text-[#9B9A97]">10 preguntas</span>
                  </div>
                  <button
                    onClick={() => handleStartQuiz(s)}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-white text-sm font-medium bg-[#37352F] hover:bg-[#2F2D2B] transition-colors disabled:opacity-50"
                  >
                    {isLoading && selectedSubject?.id === s.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Play className="w-4 h-4" />}
                    Comenzar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── QUIZ SCREEN ────────────────────────────────────────────────
  if (screen === 'quiz' && quiz) {
    return (
      <div className="p-6 max-w-3xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setScreen('select')} className="flex items-center gap-2 text-[#787774] hover:text-[#37352F] transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Salir
          </button>
          <h2 className="text-sm font-medium text-[#37352F] truncate max-w-xs">{quiz.quiz_title}</h2>
          <div className="flex items-center gap-4 text-sm text-[#787774]">
            <span className="flex items-center gap-1">
              <Target className="w-4 h-4" />
              {answeredCount}/{totalQuestions}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatTime(elapsedTime)}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-[#E9E9E7] rounded-full h-1.5 mb-8">
          <div
            className="bg-[#37352F] h-1.5 rounded-full transition-all"
            style={{ width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%` }}
          />
        </div>

        {/* Questions */}
        <div className="space-y-5">
          {quiz.questions.map((q, idx) => {
            const selected = selectedAnswers[q.id];
            const isCorrect = isSubmitted && selected === q.correct_answer;
            const isWrong = isSubmitted && selected && selected !== q.correct_answer;
            return (
              <div key={q.id} className="bg-white border border-[#E9E9E7] rounded-md p-5">
                <div className="flex items-start gap-3 mb-4">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#F7F6F3] border border-[#E9E9E7] text-[#787774] rounded-md flex items-center justify-center text-xs font-semibold">
                    {idx + 1}
                  </span>
                  <p className="text-[#37352F] text-sm font-medium leading-snug">{q.question}</p>
                  {isSubmitted && <span className="ml-auto flex-shrink-0">{getResultIcon(q)}</span>}
                </div>
                <div className="space-y-2">
                  {q.options.map(opt => {
                    const isSelected = selected === opt.letter;
                    let btnClass = 'border border-[#E9E9E7] bg-[#F7F6F3] text-[#787774] hover:border-[#9B9A97]';
                    if (isSubmitted) {
                      if (opt.letter === q.correct_answer) btnClass = 'border-2 border-[#0F7B6C] bg-[#EEF7F4] text-[#37352F] font-medium';
                      else if (isSelected && isWrong) btnClass = 'border-2 border-[#E03E3E] bg-[#FDEEEE] text-[#37352F]';
                    } else if (isSelected) {
                      btnClass = 'border-2 border-[#37352F] bg-[#F7F6F3] text-[#37352F] font-medium';
                    }
                    return (
                      <button
                        key={opt.letter}
                        disabled={isSubmitted}
                        onClick={() => handleAnswerSelect(q.id, opt.letter)}
                        className={`w-full text-left px-4 py-2.5 rounded-md text-sm transition-all ${btnClass}`}
                      >
                        <span className="font-semibold mr-2">{opt.letter}.</span>
                        {opt.text}
                      </button>
                    );
                  })}
                </div>
                {isSubmitted && q.explanation && (
                  <div className={`mt-3 p-3 rounded-md text-sm border ${isCorrect ? 'bg-[#EEF7F4] text-[#37352F] border-[#B7DDD6]' : 'bg-[#FDEEEE] text-[#37352F] border-[#F4BDBD]'}`}>
                    <span className="font-semibold">Explicación: </span>{q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Submit button */}
        {!isSubmitted && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <p className="text-sm text-[#9B9A97]">{totalQuestions - answeredCount} pregunta(s) sin responder</p>
            <button
              onClick={handleSubmit}
              disabled={answeredCount < totalQuestions}
              className="px-8 py-2.5 bg-[#37352F] text-white rounded-md font-medium hover:bg-[#2F2D2B] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Enviar Respuestas
            </button>
          </div>
        )}

        {isSubmitted && (
          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={() => { loadHistory(); setScreen('results'); }}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#37352F] text-white rounded-md font-medium hover:bg-[#2F2D2B] transition-colors disabled:opacity-70"
            >
              {isAnalyzing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando...</>
                : 'Ver Resultados'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── RESULTS SCREEN ─────────────────────────────────────────────
  if (screen === 'results') {
    const analysis = analysisResult?.analysis ?? null;
    const currentScore = analysisResult?.score ?? localScore;
    const totalQ = analysisResult?.total ?? totalQuestions;
    const duration = analysisResult?.duration ?? elapsedTime;
    const percentage = totalQ > 0 ? Math.round((currentScore / totalQ) * 100) : pct;
    const passed = percentage >= 60;

    return (
      <div className="p-6 max-w-3xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setScreen('select')} className="flex items-center gap-2 text-[#787774] hover:text-[#37352F] transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <h2 className="text-sm font-medium text-[#37352F]">Resultados</h2>
          <div />
        </div>

        {/* Score card */}
        <div className={`border rounded-md p-8 text-center mb-5 ${passed ? 'bg-[#EEF7F4] border-[#B7DDD6]' : 'bg-[#FDEEEE] border-[#F4BDBD]'}`}>
          <Trophy className={`w-10 h-10 mx-auto mb-2 ${passed ? 'text-[#0F7B6C]' : 'text-[#E03E3E]'}`} />
          <div className={`text-5xl font-bold mb-1 ${passed ? 'text-[#0F7B6C]' : 'text-[#E03E3E]'}`}>{percentage}%</div>
          <p className={`text-sm ${passed ? 'text-[#0F7B6C]' : 'text-[#E03E3E]'}`}>{passed ? '¡Excelente trabajo!' : 'Sigue practicando'}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { icon: CheckCircle, label: 'Correctas',   value: currentScore,        color: 'text-[#0F7B6C]' },
            { icon: XCircle,     label: 'Incorrectas', value: totalQ - currentScore, color: 'text-[#E03E3E]' },
            { icon: Clock,       label: 'Tiempo',      value: formatTime(duration), color: 'text-[#787774]' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-white border border-[#E9E9E7] rounded-md p-4 text-center">
              <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
              <div className={`text-xl font-semibold ${color}`}>{value}</div>
              <div className="text-xs text-[#9B9A97]">{label}</div>
            </div>
          ))}
        </div>

        {/* Analysis */}
        {analysis && (
          <div className="bg-white border border-[#E9E9E7] rounded-md p-5 mb-5 space-y-3">
            {analysis.adaptation_message && (
              <p className="text-sm text-[#37352F] bg-[#F7F6F3] border border-[#E9E9E7] rounded-md px-3 py-2">{analysis.adaptation_message}</p>
            )}
            {analysis.weak_concepts?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-[#37352F] mb-2">Conceptos a reforzar:</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.weak_concepts.map((c, i) => (
                    <span key={i} className="px-2 py-1 bg-[#FCF6E5] border border-[#EDD88A] text-[#DFAB01] rounded-md text-xs">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {analysis.recommended_difficulty && (
              <p className="text-sm text-[#787774]">
                Próximo nivel recomendado:{' '}
                <span className={`font-medium px-2 py-0.5 rounded-md border text-xs ${DIFF_COLORS[analysis.recommended_difficulty as Difficulty] ?? 'bg-[#F7F6F3] text-[#787774] border-[#E9E9E7]'}`}>
                  {DIFF_LABELS[analysis.recommended_difficulty as Difficulty] ?? analysis.recommended_difficulty}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 justify-center mb-8">
          <button onClick={handleRetryQuiz} className="flex items-center gap-2 px-5 py-2.5 bg-[#37352F] text-white rounded-md text-sm font-medium hover:bg-[#2F2D2B] transition-colors">
            <RotateCcw className="w-4 h-4" /> Repetir Quiz
          </button>
          <button onClick={() => setScreen('select')} className="flex items-center gap-2 px-5 py-2.5 border border-[#E9E9E7] text-[#787774] rounded-md text-sm font-medium hover:bg-[#F7F6F3] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Cambiar Materia
          </button>
          <button onClick={() => { setScreen('history'); loadHistory(); }} className="flex items-center gap-2 px-5 py-2.5 border border-[#E9E9E7] text-[#787774] rounded-md text-sm font-medium hover:bg-[#F7F6F3] transition-colors">
            <Trophy className="w-4 h-4" /> Ver Historial
          </button>
        </div>

        {/* Question review */}
        {quiz && (
          <div>
            <h3 className="text-sm font-semibold text-[#37352F] mb-4">Revisión de preguntas</h3>
            <div className="space-y-3">
              {quiz.questions.map((q, idx) => {
                const answer = selectedAnswers[q.id];
                const correct = answer === q.correct_answer;
                return (
                  <div key={q.id} className={`rounded-md border p-4 ${correct ? 'border-[#B7DDD6] bg-[#EEF7F4]' : 'border-[#F4BDBD] bg-[#FDEEEE]'}`}>
                    <div className="flex items-start gap-3">
                      {correct ? <CheckCircle className="w-4 h-4 text-[#0F7B6C] flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-[#E03E3E] flex-shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#37352F] mb-1">{idx + 1}. {q.question}</p>
                        <p className="text-xs text-[#787774]">Tu respuesta: <span className={`font-semibold ${correct ? 'text-[#0F7B6C]' : 'text-[#E03E3E]'}`}>{answer || 'Sin respuesta'}</span></p>
                        {!correct && <p className="text-xs text-[#787774]">Correcta: <span className="font-semibold text-[#0F7B6C]">{q.correct_answer}</span></p>}
                        {q.explanation && <p className="text-xs text-[#9B9A97] mt-1 italic">{q.explanation}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── HISTORY SCREEN ─────────────────────────────────────────────
  if (screen === 'history') {
    return (
      <div className="p-6 max-w-4xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="pb-5 mb-6 border-b border-[#E9E9E7] flex items-center justify-between">
          <button onClick={() => setScreen('select')} className="flex items-center gap-2 text-[#787774] hover:text-[#37352F] transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <h2 className="text-sm font-semibold text-[#37352F]">Historial de Desafíos</h2>
          <div />
        </div>

        {historyLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#9B9A97]" />
          </div>
        ) : quizHistory.length === 0 ? (
          <div className="text-center py-16 text-[#9B9A97]">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-[#787774]">Aún no has hecho ningún quiz</p>
            <button onClick={() => setScreen('select')} className="mt-4 px-5 py-2 bg-[#37352F] text-white rounded-md text-sm font-medium hover:bg-[#2F2D2B] transition-colors">
              Empezar ahora
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {quizHistory.map(entry => {
              const pctH = entry.questions_count > 0 ? Math.round((entry.user_score / entry.questions_count) * 100) : Math.round((entry.performance_score ?? 0) * 100);
              const passedH = pctH >= 60;
              const diff = (entry.difficulty ?? 'medio') as Difficulty;
              return (
                <div key={entry.id} className="bg-white border border-[#E9E9E7] rounded-md p-4 flex items-center gap-4 hover:border-[#9B9A97] transition-colors">
                  <div className={`w-12 h-12 rounded-md flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 ${passedH ? 'bg-[#0F7B6C]' : 'bg-[#37352F]'}`}>
                    {pctH}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#37352F] text-sm truncate">{entry.quiz_title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${DIFF_COLORS[diff] ?? 'bg-[#F7F6F3] text-[#787774] border-[#E9E9E7]'}`}>
                        {DIFF_LABELS[diff] ?? diff}
                      </span>
                      <span className="text-xs text-[#9B9A97]">{entry.user_score ?? Math.round((entry.performance_score ?? 0) * (entry.questions_count ?? 10))}/{entry.questions_count ?? 10} correctas</span>
                      <span className="text-xs text-[#9B9A97]">{new Date(entry.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  {entry.recommended_difficulty && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-[#9B9A97]">Recomendado</p>
                      <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${DIFF_COLORS[entry.recommended_difficulty as Difficulty] ?? 'bg-[#F7F6F3] text-[#787774] border-[#E9E9E7]'}`}>
                        {DIFF_LABELS[entry.recommended_difficulty as Difficulty] ?? entry.recommended_difficulty}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
}