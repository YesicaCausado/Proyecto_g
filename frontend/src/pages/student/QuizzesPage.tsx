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
  { id: 'matematicas', label: 'Matemáticas', desc: 'Álgebra, geometría y más', icon: Calculator, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', btnColor: 'bg-blue-600 hover:bg-blue-700' },
  { id: 'lectura', label: 'Lectura Crítica', desc: 'Comprensión y análisis', icon: BookOpen, color: 'from-purple-500 to-purple-600', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', btnColor: 'bg-purple-600 hover:bg-purple-700' },
  { id: 'ciencias', label: 'Ciencias', desc: 'Física, química y biología', icon: FlaskConical, color: 'from-green-500 to-green-600', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', btnColor: 'bg-green-600 hover:bg-green-700' },
  { id: 'sociales', label: 'Sociales', desc: 'Historia y geografía', icon: Globe, color: 'from-orange-500 to-orange-600', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', btnColor: 'bg-orange-600 hover:bg-orange-700' },
  { id: 'ingles', label: 'Inglés', desc: 'Grammar, vocabulary & more', icon: Languages, color: 'from-pink-500 to-pink-600', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', btnColor: 'bg-pink-600 hover:bg-pink-700' },
];

const DIFF_LABELS: Record<Difficulty, string> = { facil: 'Fácil', medio: 'Medio', dificil: 'Difícil' };
const DIFF_COLORS: Record<Difficulty, string> = {
  facil: 'bg-green-100 text-green-800 border-green-300',
  medio: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  dificil: 'bg-red-100 text-red-800 border-red-300',
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
    if (!answer) return <AlertCircle className="w-5 h-5 text-gray-400" />;
    return answer === q.correct_answer
      ? <CheckCircle className="w-5 h-5 text-green-500" />
      : <XCircle className="w-5 h-5 text-red-500" />;
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const totalQuestions = quiz?.questions.length ?? 0;
  const pct = totalQuestions > 0 ? Math.round((localScore / totalQuestions) * 100) : 0;

  // ── GENERATING SCREEN ─────────────────────────────────────────
  if (screen === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-16 h-16 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-[#9B9B9B] animate-spin" />
        </div>
        <div className="text-center">
          <h2 className="text-base font-semibold text-[#2F3437] mb-1">Generando tu quiz…</h2>
          <p className="text-[#707070] text-sm">
            La IA está preparando 10 preguntas de <span className="font-medium text-[#2F3437]">{selectedSubject?.label}</span>
          </p>
          <p className="text-[#9B9B9B] text-xs mt-1">Nivel: {DIFF_LABELS[difficulty]}</p>
        </div>
      </div>
    );
  }

  // ── SELECT SCREEN ──────────────────────────────────────────────
  if (screen === 'select') {
    return (
      <div className="p-6 max-w-5xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="pb-5 mb-6 border-b border-[#E0E0E0] flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#2F3437]">Desafíos</h1>
            <p className="text-[#707070] text-sm mt-1">Elige una materia, selecciona el nivel y pon a prueba tu conocimiento</p>
          </div>
          <button
            onClick={() => { setScreen('history'); loadHistory(); }}
            className="flex items-center gap-2 px-4 py-2 border border-[#E0E0E0] bg-white text-[#707070] hover:bg-[#F7F6F3] hover:text-[#2F3437] rounded-md transition-colors text-sm font-medium"
          >
            <Trophy className="w-4 h-4" />
            Historial
          </button>
        </div>

        {/* Difficulty selector */}
        <div className="flex items-center gap-3 mb-6 p-4 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md">
          <span className="text-sm font-medium text-[#2F3437]">Nivel de dificultad:</span>
          {(['facil', 'medio', 'dificil'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium border transition-all ${
                difficulty === d
                  ? 'bg-[#2F3437] text-white border-[#2F3437]'
                  : 'bg-white text-[#707070] border-[#E0E0E0] hover:border-[#9B9B9B]'
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
              <div key={s.id} className="bg-white border border-[#E0E0E0] rounded-md hover:border-[#9B9B9B] transition-colors overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-[#707070]" />
                    </div>
                    <div>
                      <h3 className="font-medium text-[#2F3437] text-sm">{s.label}</h3>
                      <p className="text-xs text-[#9B9B9B] mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-md border ${DIFF_COLORS[difficulty]}`}>{DIFF_LABELS[difficulty]}</span>
                    <span className="text-xs text-[#9B9B9B]">10 preguntas</span>
                  </div>
                  <button
                    onClick={() => handleStartQuiz(s)}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-white text-sm font-medium bg-[#2F3437] hover:bg-[#454A4D] transition-colors disabled:opacity-50"
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
          <button onClick={() => setScreen('select')} className="flex items-center gap-2 text-[#707070] hover:text-[#2F3437] transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Salir
          </button>
          <h2 className="text-sm font-medium text-[#2F3437] truncate max-w-xs">{quiz.quiz_title}</h2>
          <div className="flex items-center gap-4 text-sm text-[#707070]">
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
        <div className="w-full bg-[#E0E0E0] rounded-full h-1.5 mb-8">
          <div
            className="bg-[#2F3437] h-1.5 rounded-full transition-all"
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
              <div key={q.id} className="bg-white border border-[#E0E0E0] rounded-md p-5">
                <div className="flex items-start gap-3 mb-4">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#F7F6F3] border border-[#E0E0E0] text-[#707070] rounded-md flex items-center justify-center text-xs font-semibold">
                    {idx + 1}
                  </span>
                  <p className="text-[#2F3437] text-sm font-medium leading-snug">{q.question}</p>
                  {isSubmitted && <span className="ml-auto flex-shrink-0">{getResultIcon(q)}</span>}
                </div>
                <div className="space-y-2">
                  {q.options.map(opt => {
                    const isSelected = selected === opt.letter;
                    let btnClass = 'border border-[#E0E0E0] bg-[#F7F6F3] text-[#707070] hover:border-[#9B9B9B]';
                    if (isSubmitted) {
                      if (opt.letter === q.correct_answer) btnClass = 'border-2 border-green-500 bg-green-50 text-green-800 font-medium';
                      else if (isSelected && isWrong) btnClass = 'border-2 border-red-400 bg-red-50 text-red-800';
                    } else if (isSelected) {
                      btnClass = 'border-2 border-[#2F3437] bg-[#F7F6F3] text-[#2F3437] font-medium';
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
                  <div className={`mt-3 p-3 rounded-md text-sm border ${isCorrect ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
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
            <p className="text-sm text-[#9B9B9B]">{totalQuestions - answeredCount} pregunta(s) sin responder</p>
            <button
              onClick={handleSubmit}
              disabled={answeredCount < totalQuestions}
              className="px-8 py-2.5 bg-[#2F3437] text-white rounded-md font-medium hover:bg-[#454A4D] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
              className="flex items-center gap-2 px-6 py-2.5 bg-[#2F3437] text-white rounded-md font-medium hover:bg-[#454A4D] transition-colors disabled:opacity-70"
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
          <button onClick={() => setScreen('select')} className="flex items-center gap-2 text-[#707070] hover:text-[#2F3437] transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <h2 className="text-sm font-medium text-[#2F3437]">Resultados</h2>
          <div />
        </div>

        {/* Score card */}
        <div className={`border rounded-md p-8 text-center mb-5 ${passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <Trophy className={`w-10 h-10 mx-auto mb-2 ${passed ? 'text-green-600' : 'text-red-500'}`} />
          <div className={`text-5xl font-bold mb-1 ${passed ? 'text-green-700' : 'text-red-600'}`}>{percentage}%</div>
          <p className={`text-sm ${passed ? 'text-green-700' : 'text-red-600'}`}>{passed ? '¡Excelente trabajo!' : 'Sigue practicando'}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { icon: CheckCircle, label: 'Correctas',   value: currentScore,        color: 'text-green-600' },
            { icon: XCircle,     label: 'Incorrectas', value: totalQ - currentScore, color: 'text-red-600' },
            { icon: Clock,       label: 'Tiempo',      value: formatTime(duration), color: 'text-[#707070]' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-white border border-[#E0E0E0] rounded-md p-4 text-center">
              <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
              <div className={`text-xl font-semibold ${color}`}>{value}</div>
              <div className="text-xs text-[#9B9B9B]">{label}</div>
            </div>
          ))}
        </div>

        {/* Analysis */}
        {analysis && (
          <div className="bg-white border border-[#E0E0E0] rounded-md p-5 mb-5 space-y-3">
            {analysis.adaptation_message && (
              <p className="text-sm text-[#2F3437] bg-[#F7F6F3] border border-[#E0E0E0] rounded-md px-3 py-2">{analysis.adaptation_message}</p>
            )}
            {analysis.weak_concepts?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-[#2F3437] mb-2">Conceptos a reforzar:</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.weak_concepts.map((c, i) => (
                    <span key={i} className="px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-md text-xs">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {analysis.recommended_difficulty && (
              <p className="text-sm text-[#707070]">
                Próximo nivel recomendado:{' '}
                <span className={`font-medium px-2 py-0.5 rounded-md border text-xs ${DIFF_COLORS[analysis.recommended_difficulty as Difficulty] ?? 'bg-[#F7F6F3] text-[#707070] border-[#E0E0E0]'}`}>
                  {DIFF_LABELS[analysis.recommended_difficulty as Difficulty] ?? analysis.recommended_difficulty}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 justify-center mb-8">
          <button onClick={handleRetryQuiz} className="flex items-center gap-2 px-5 py-2.5 bg-[#2F3437] text-white rounded-md text-sm font-medium hover:bg-[#454A4D] transition-colors">
            <RotateCcw className="w-4 h-4" /> Repetir Quiz
          </button>
          <button onClick={() => setScreen('select')} className="flex items-center gap-2 px-5 py-2.5 border border-[#E0E0E0] text-[#707070] rounded-md text-sm font-medium hover:bg-[#F7F6F3] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Cambiar Materia
          </button>
          <button onClick={() => { setScreen('history'); loadHistory(); }} className="flex items-center gap-2 px-5 py-2.5 border border-[#E0E0E0] text-[#707070] rounded-md text-sm font-medium hover:bg-[#F7F6F3] transition-colors">
            <Trophy className="w-4 h-4" /> Ver Historial
          </button>
        </div>

        {/* Question review */}
        {quiz && (
          <div>
            <h3 className="text-sm font-semibold text-[#2F3437] mb-4">Revisión de preguntas</h3>
            <div className="space-y-3">
              {quiz.questions.map((q, idx) => {
                const answer = selectedAnswers[q.id];
                const correct = answer === q.correct_answer;
                return (
                  <div key={q.id} className={`rounded-md border p-4 ${correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex items-start gap-3">
                      {correct ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#2F3437] mb-1">{idx + 1}. {q.question}</p>
                        <p className="text-xs text-[#707070]">Tu respuesta: <span className={`font-semibold ${correct ? 'text-green-700' : 'text-red-700'}`}>{answer || 'Sin respuesta'}</span></p>
                        {!correct && <p className="text-xs text-[#707070]">Correcta: <span className="font-semibold text-green-700">{q.correct_answer}</span></p>}
                        {q.explanation && <p className="text-xs text-[#9B9B9B] mt-1 italic">{q.explanation}</p>}
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
        <div className="pb-5 mb-6 border-b border-[#E0E0E0] flex items-center justify-between">
          <button onClick={() => setScreen('select')} className="flex items-center gap-2 text-[#707070] hover:text-[#2F3437] transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <h2 className="text-sm font-semibold text-[#2F3437]">Historial de Desafíos</h2>
          <div />
        </div>

        {historyLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#9B9B9B]" />
          </div>
        ) : quizHistory.length === 0 ? (
          <div className="text-center py-16 text-[#9B9B9B]">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-[#707070]">Aún no has hecho ningún quiz</p>
            <button onClick={() => setScreen('select')} className="mt-4 px-5 py-2 bg-[#2F3437] text-white rounded-md text-sm font-medium hover:bg-[#454A4D] transition-colors">
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
                <div key={entry.id} className="bg-white border border-[#E0E0E0] rounded-md p-4 flex items-center gap-4 hover:border-[#9B9B9B] transition-colors">
                  <div className={`w-12 h-12 rounded-md flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 ${passedH ? 'bg-green-600' : 'bg-[#2F3437]'}`}>
                    {pctH}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#2F3437] text-sm truncate">{entry.quiz_title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${DIFF_COLORS[diff] ?? 'bg-[#F7F6F3] text-[#707070] border-[#E0E0E0]'}`}>
                        {DIFF_LABELS[diff] ?? diff}
                      </span>
                      <span className="text-xs text-[#9B9B9B]">{entry.user_score ?? Math.round((entry.performance_score ?? 0) * (entry.questions_count ?? 10))}/{entry.questions_count ?? 10} correctas</span>
                      <span className="text-xs text-[#9B9B9B]">{new Date(entry.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  {entry.recommended_difficulty && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-[#9B9B9B]">Recomendado</p>
                      <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${DIFF_COLORS[entry.recommended_difficulty as Difficulty] ?? 'bg-[#F7F6F3] text-[#707070] border-[#E0E0E0]'}`}>
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