import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Play, Star, Clock, ShieldCheck, Home, Trophy, Sparkles, ChevronRight, HelpCircle } from 'lucide-react';

// --- Types ---
type Screen = 'home' | 'playing' | 'result' | 'guide';
type Level = 1 | 2 | 3;
type BlankType = 'a' | 'b' | 'c' | 'none';

interface Question {
  id: string;
  a: number; // Multiplicand (단)
  b: number; // Multiplier (1~9)
  c: number; // Answer (a * b)
  blank: BlankType;
  userAnswer: string;
  isCorrect: boolean | null;
  shake?: boolean;
}

// --- Audio Utility ---
const playTone = (type: 'success' | 'error' | 'bell') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'error') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'bell') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.5);
    }
  } catch(e) {
    console.log('Audio error', e);
  }
};

// --- Helper Functions ---
const generateQuestions = (dan: number | 'all', level: Level): Question[] => {
  const qList: Question[] = [];
  
  if (level === 1 || level === 2) {
    // Sequential 1~9
    const blankCount = level === 1 ? 3 : 6;
    const indices = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const shuffledIndices = [...indices].sort(() => Math.random() - 0.5);
    const blankIndices = new Set(shuffledIndices.slice(0, blankCount));

    for (let i = 1; i <= 9; i++) {
      const targetDan = dan === 'all' ? Math.floor(Math.random() * 8) + 2 : dan;
      const isBlank = blankIndices.has(i);
      qList.push({
        id: `q-${Date.now()}-${i}`,
        a: targetDan,
        b: i,
        c: targetDan * i,
        blank: isBlank ? 'c' : 'none',
        userAnswer: '',
        isCorrect: isBlank ? null : true
      });
    }
  } else {
    // Level 3: Random order, mixed blanks
    const indices = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 9; i++) {
      const bValue = indices[i];
      const targetDan = dan === 'all' ? Math.floor(Math.random() * 8) + 2 : dan;
      // 50% chance for 'b' or 'c' blank
      const blankType: BlankType = Math.random() > 0.5 ? 'b' : 'c';
      qList.push({
        id: `q-${Date.now()}-lvl3-${i}`,
        a: targetDan,
        b: bValue,
        c: targetDan * bValue,
        blank: blankType,
        userAnswer: '',
        isCorrect: null
      });
    }
  }
  return qList;
};

// --- Components ---

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [dan, setDan] = useState<number | 'all'>(2);
  const [level, setLevel] = useState<Level>(1);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const timerRef = useRef<number | null>(null);

  const [worksheet, setWorksheet] = useState<{lvl1: Question[], lvl2: Question[], lvl3: Question[]}>({lvl1: [], lvl2: [], lvl3: []});

  const generateWorksheet = () => {
    const genQ = (lvl: number, idPrefix: string): Question => {
      const a = Math.floor(Math.random() * 8) + 2;
      const b = Math.floor(Math.random() * 9) + 1;
      let blank: BlankType = 'c';
      if (lvl === 2) {
        const r = Math.random();
        if (r < 0.3) blank = 'a';
        else if (r < 0.6) blank = 'b';
      } else if (lvl === 3) {
        blank = Math.random() < 0.5 ? 'a' : 'b'; 
      }
      return { id: idPrefix, a, b, c: a*b, blank, userAnswer: '', isCorrect: null };
    };
    setWorksheet({
      lvl1: Array.from({length: 10}, (_, i) => genQ(1, `w1-${i}`)),
      lvl2: Array.from({length: 10}, (_, i) => genQ(2, `w2-${i}`)),
      lvl3: Array.from({length: 15}, (_, i) => genQ(3, `w3-${i}`))
    });
  };

  useEffect(() => {
    generateWorksheet();
  }, []);

  // Home Screen Start
  const startGame = () => {
    const qs = generateQuestions(dan, level);
    setQuestions(qs);
    setScreen('playing');
    setStartTime(Date.now());
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000) as unknown as number;
  };

  // Timer Update
  useEffect(() => {
    if (screen === 'playing') {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [screen, startTime]);

  // Check Game End
  useEffect(() => {
    if (screen === 'playing' && questions.length > 0) {
      if (questions.every(q => q.isCorrect)) {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeout(() => {
          playTone('bell');
          setScreen('result');
        }, 600);
      }
    }
  }, [questions, screen]);

  // Handle Input
  const handleInput = (id: string, val: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== id) return q;
      
      const cleanVal = val.replace(/[^0-9]/g, '');
      const targetStr = String(q.blank === 'c' ? q.c : (q.blank === 'b' ? q.b : q.a));
      
      let isCorrect: boolean | null = null;
      let shouldShake = false;

      // If user typed the exact correct string
      if (cleanVal === targetStr) {
        isCorrect = true;
        playTone('success');
      } 
      // If user typed wrong answer that has the same length as the correct answer
      else if (cleanVal.length >= targetStr.length) {
        isCorrect = false;
        shouldShake = true;
        playTone('error');
      }

      return {
        ...q,
        userAnswer: isCorrect === false ? '' : cleanVal, // clear if wrong so they can type again
        isCorrect,
        shake: shouldShake
      };
    }));

    // Reset shake after animation
    setTimeout(() => {
      setQuestions(prev => prev.map(q => q.id === id ? { ...q, shake: false } : q));
    }, 500);
  };

  const getLevelName = (lvl: Level) => {
    if (lvl === 1) return '브론즈 (빈칸 3개)';
    if (lvl === 2) return '실버 (빈칸 6개)';
    return '골드 (모두 빈칸/랜덤)';
  };

  // Format Time
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="app-layout min-h-screen bg-[#FBFBFD] w-full flex flex-col xl:flex-row gap-6 p-4 xl:p-8 font-['Inter'] break-keep">
      
      {/* Interactive Area */}
      <div className="interactive-area flex-1 xl:flex-[1.4] bg-white rounded-2xl sm:rounded-[32px] border border-gray-200 apple-shadow flex flex-col relative w-full xl:min-w-[500px]">
        <AnimatePresence mode="wait">
          
          {/* --- HOME SCREEN --- */}
          {screen === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col flex-1 h-full w-full p-6 sm:p-8 space-y-8 overflow-y-auto"
            >
              <div className="p-2 flex flex-col border-b border-gray-100 pb-6 relative">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">수학 퀘스트</span>
                <h1 className="text-2xl font-bold text-gray-800 mt-1">신나는 구구단 마스터</h1>
                <button 
                  onClick={() => setScreen('guide')}
                  className="absolute right-2 top-2 p-2 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-blue-600 rounded-full transition-colors flex items-center justify-center group"
                  title="앱 사용 안내"
                >
                  <HelpCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
              </div>

              {/* Dan Selection */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest ml-1">몇 단을 연습할까요?</h2>
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  {[2,3,4,5,6,7,8,9].map(d => (
                    <button
                      key={d}
                      onClick={() => setDan(d)}
                      className={`btn-stage h-12 sm:h-14 rounded-xl font-bold text-base sm:text-lg transition-all ${
                        dan === d 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {d}단
                    </button>
                  ))}
                  <button
                    onClick={() => setDan('all')}
                    className={`btn-stage col-span-4 h-12 sm:h-14 rounded-xl font-bold text-base sm:text-lg transition-all ${
                      dan === 'all' 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    랜덤 섞기 (전체 단)
                  </button>
                </div>
              </div>

              {/* Level Selection */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest ml-1">난이도 선택</h2>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setLevel(1)}
                    className={`btn-stage flex-1 p-4 rounded-2xl transition-all font-bold ${level === 1 ? 'bg-blue-50 border-2 border-blue-400 text-blue-600' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}
                  >
                    1단계 (쉬움)
                  </button>
                  <button
                    onClick={() => setLevel(2)}
                    className={`btn-stage flex-1 p-4 rounded-2xl transition-all font-bold ${level === 2 ? 'bg-blue-50 border-2 border-blue-400 text-blue-600' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}
                  >
                    2단계 (보통)
                  </button>
                  <button
                    onClick={() => setLevel(3)}
                    className={`btn-stage flex-1 p-4 rounded-2xl transition-all font-bold ${level === 3 ? 'bg-blue-50 border-2 border-blue-400 text-blue-600' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}
                  >
                    3단계 (어려움)
                  </button>
                </div>
              </div>

              <div className="flex-1"></div>

              <button
                onClick={startGame}
                className="w-full bg-blue-600 text-white rounded-2xl p-5 font-bold text-lg flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-200"
              >
                <Play className="w-5 h-5 fill-white" />
                학습 시작하기
              </button>
            </motion.div>
          )}

          {/* --- GUIDE SCREEN --- */}
          {screen === 'guide' && (
            <motion.div 
              key="guide"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col flex-1 h-full w-full p-6 sm:p-8 space-y-6 overflow-y-auto"
            >
              <div className="flex items-center pb-4 border-b border-gray-100">
                <button 
                  onClick={() => setScreen('home')} 
                  className="flex items-center text-gray-500 hover:text-gray-800 font-bold transition-colors bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-xl"
                >
                  <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> 되돌아가기
                </button>
              </div>
              
              <div className="flex flex-col mb-2">
                <span className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-1">Guide</span>
                <h1 className="text-2xl font-extrabold text-gray-800">📖 구구단 퀘스트 안내서</h1>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50/70 p-5 rounded-2xl border border-blue-100">
                  <h2 className="text-lg font-bold text-blue-800 mb-3 flex items-center gap-2">🎮 이렇게 시작해요!</h2>
                  <ul className="space-y-2.5 text-base sm:text-[17px] text-blue-900/90 font-medium list-disc list-inside">
                    <li>공부하고 싶은 <strong className="text-blue-800">구구단 숫자</strong>를 콕! 눌러요.</li>
                    <li>나에게 맞는 <strong className="text-blue-800">난이도 (1~3단계)</strong>를 선택해요.</li>
                    <li><strong>[학습 시작하기]</strong> 버튼을 누르면 출발해요! 🚀</li>
                  </ul>
                </div>

                <div className="bg-green-50/70 p-5 rounded-2xl border border-green-100">
                  <h2 className="text-lg font-bold text-green-800 mb-3 flex items-center gap-2">✨ 이런 규칙이 있어요</h2>
                  <ul className="space-y-2.5 text-base sm:text-[17px] text-green-900/90 font-medium list-disc list-inside">
                    <li>화면에 보이는 빈칸에 알맞은 숫자를 자판으로 적어주세요.</li>
                    <li>맞히면 <strong className="text-green-700">초록색!</strong> 딩동댕 🎵 소리가 나요.</li>
                    <li>틀리면 <strong className="text-red-500">빨간색!</strong> 흔들흔들해요. 다시 고쳐볼 수 있어요.</li>
                  </ul>
                </div>

                <div className="bg-purple-50/70 p-5 rounded-2xl border border-purple-100">
                  <h2 className="text-lg font-bold text-purple-800 mb-3 flex items-center gap-2">🖨️ 종이 학습지로도 풀 수 있어요!</h2>
                  <ul className="space-y-2.5 text-base sm:text-[17px] text-purple-900/90 font-medium list-disc list-inside">
                    <li>우측(오른쪽)에 있는 <strong>[학습지 미리보기]</strong> 화면을 보세요.</li>
                    <li><strong>[인쇄하기]</strong> 버튼을 누르면 종이로 인쇄해서 시험을 볼 수 있어요!</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {/* --- PLAYING SCREEN --- */}
          {screen === 'playing' && (
            <motion.div 
              key="playing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col flex-1 h-full w-full"
            >
              {/* Header */}
              <div className="p-4 sm:p-6 flex justify-between items-center border-b border-gray-100 bg-white z-10 rounded-t-[32px]">
                <div className="flex flex-col">
                  <span className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <button onClick={() => setScreen('home')} className="hover:text-gray-600 transition-colors"><ChevronRight className="w-4 h-4 rotate-180" /></button>
                    Level 0{level} · {dan === 'all' ? '랜덤' : `${dan}단`}
                  </span>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">구구단 퀘스트</h1>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 bg-gray-50 px-3 sm:px-4 py-2 rounded-2xl border border-gray-100">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <span className="text-lg sm:text-xl font-mono font-semibold text-gray-700">{formatTime(elapsedTime)}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-100 h-2">
                <motion.div 
                  className="h-full bg-green-400 shadow-sm"
                  initial={{ width: '0%' }}
                  animate={{ width: `${(questions.filter(q => q.isCorrect).length / 9) * 100}%` }}
                  transition={{ ease: "easeOut", duration: 0.3 }}
                />
              </div>

              {/* Questions Form */}
              <div className="flex-1 p-4 sm:p-6 bg-slate-50/50 overflow-y-auto space-y-4">
                {questions.map((q, idx) => {
                  const isComplete = q.isCorrect === true;
                  
                  return (
                    <motion.div 
                      key={q.id}
                      animate={q.shake ? { x: [-5, 5, -5, 5, 0] } : {}}
                      transition={{ duration: 0.4 }}
                      className={`flex items-center justify-center gap-2 sm:gap-6 py-4 sm:py-6 px-2 sm:px-6 rounded-3xl border-2 transition-colors ${
                        isComplete 
                          ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-md shadow-blue-100/50' 
                          : (q.shake ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-gray-100 shadow-sm')
                      }`}
                    >
                      {/* A part */}
                      {q.blank === 'a' ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={q.userAnswer}
                          onChange={(e) => handleInput(q.id, e.target.value)}
                          disabled={isComplete}
                          autoFocus={idx === questions.findIndex(cq => cq.isCorrect !== true)}
                          className={`w-14 h-14 sm:w-20 sm:h-20 text-3xl sm:text-4xl font-bold text-center rounded-2xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all ${
                            isComplete ? 'bg-transparent border-transparent !text-blue-600' : 'text-gray-800'
                          }`}
                        />
                      ) : (
                        <span className="text-4xl sm:text-6xl font-black w-12 sm:w-16 text-center">{q.a}</span>
                      )}

                      <span className="text-3xl sm:text-5xl text-gray-300 font-bold">×</span>
                      
                      {/* B part */}
                      {q.blank === 'b' ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={q.userAnswer}
                          onChange={(e) => handleInput(q.id, e.target.value)}
                          disabled={isComplete}
                          autoFocus={idx === questions.findIndex(cq => cq.isCorrect !== true)}
                          className={`w-14 h-14 sm:w-20 sm:h-20 text-3xl sm:text-4xl font-bold text-center rounded-2xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all ${
                            isComplete ? 'bg-transparent border-transparent !text-blue-600' : 'text-gray-800'
                          }`}
                        />
                      ) : (
                        <span className="text-4xl sm:text-6xl font-black w-12 sm:w-16 text-center">{q.b}</span>
                      )}

                      <span className="text-3xl sm:text-5xl text-gray-300 font-bold">=</span>

                      {/* C part (Answer) */}
                      {q.blank === 'c' ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={q.userAnswer}
                          onChange={(e) => handleInput(q.id, e.target.value)}
                          disabled={isComplete}
                          autoFocus={idx === questions.findIndex(cq => cq.isCorrect !== true)}
                          className={`w-16 h-14 sm:w-24 sm:h-20 text-3xl sm:text-4xl font-bold text-center rounded-2xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all ${
                            isComplete ? 'bg-transparent border-transparent !text-blue-600' : 'text-gray-800'
                          }`}
                        />
                      ) : (
                        <div className="w-16 sm:w-24 h-14 sm:h-20 rounded-2xl bg-blue-50 border-4 border-blue-400 flex items-center justify-center">
                           <span className="text-4xl sm:text-5xl font-black text-blue-600">{q.c}</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* --- RESULT SCREEN --- */}
          {screen === 'result' && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col flex-1 items-center justify-center text-center p-8 w-full"
            >
              <div className="w-24 h-24 sm:w-32 sm:h-32 bg-green-50 rounded-[32px] border-4 border-green-400 flex items-center justify-center mb-6">
                <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-green-500" />
              </div>
              
              <div className="space-y-4 mb-8">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800">모두 맞혔어요! 👏</h1>
                <p className="text-gray-500 font-semibold text-lg sm:text-xl">
                  {dan === 'all' ? '전체 단' : `${dan}단`} {getLevelName(level)} 완료!
                </p>
              </div>

              <div className="bg-gray-50 rounded-[32px] border border-gray-200 p-6 sm:p-8 w-full max-w-sm flex items-center justify-between mb-8">
                <div className="text-left">
                  <div className="text-xs sm:text-sm text-gray-400 font-bold mb-1 uppercase tracking-widest">소요 시간</div>
                  <div className="text-2xl sm:text-3xl font-black text-gray-800 font-mono">{formatTime(elapsedTime)}</div>
                </div>
                <div className="h-12 w-px bg-gray-200"></div>
                <div className="text-right">
                  <div className="text-xs sm:text-sm text-gray-400 font-bold mb-1 uppercase tracking-widest">정답률</div>
                  <div className="text-2xl sm:text-3xl font-black text-green-500">100%</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                <button
                  onClick={startGame}
                  className="flex-1 bg-green-50 text-green-600 rounded-2xl p-4 font-bold text-lg flex items-center justify-center border-2 border-green-200 hover:bg-green-100 active:scale-95 transition-all"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  다시하기
                </button>
                <button
                  onClick={() => setScreen('home')}
                  className="flex-1 bg-blue-600 text-white rounded-2xl p-4 font-bold text-lg flex items-center justify-center shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all w-full"
                >
                  <Home className="w-5 h-5 mr-2" />
                  처음으로
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Printable Preview Area */}
      <div className="printable-preview flex-1 bg-gray-200 rounded-[32px] p-5 flex flex-col items-center min-h-[500px] xl:min-h-[700px] h-auto xl:h-full overflow-hidden">
        <div className="preview-header w-full flex justify-between items-center mb-4 px-2">
          <span className="text-gray-600 font-bold text-sm">🖨️ 학습지 미리보기</span>
          <div className="flex gap-2">
            <button onClick={generateWorksheet} className="text-xs bg-white text-gray-700 py-2 px-4 rounded-full font-bold shadow-sm border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
               <RefreshCw className="w-3.5 h-3.5"/>생성
            </button>
            <button onClick={() => window.print()} className="text-xs bg-blue-600 text-white py-2 px-4 rounded-full font-bold shadow-sm border border-blue-700 hover:bg-blue-700 transition-colors">
              인쇄하기
            </button>
          </div>
        </div>

        <div className="worksheet-page bg-white w-full max-w-[800px] rounded-[16px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] p-6 md:p-10 text-gray-800 flex-1 overflow-y-auto">
            <div className="border-b-[3px] border-gray-800 pb-3 mb-6">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl md:text-2xl font-black tracking-tight">{new Date().getFullYear()}학년 구구단 단계별 마스터</h2>
                <div className="text-[11px] md:text-xs text-right font-medium space-y-1">
                  <p>이름: ________________</p>
                  <p>날짜: 20__ . __ . __</p>
                </div>
              </div>
              <p className="text-[11px] md:text-xs text-gray-500 font-medium">목표: 2단부터 9단까지 빈칸을 채우며 구구단을 완벽하게 외워봅시다.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4 md:gap-6">
              {/* Level 1 */}
              <div className="border-[1.5px] border-dashed border-gray-300 p-4 md:p-5 rounded-2xl bg-gray-50/50">
                <h3 className="font-bold mb-4 text-blue-600 text-sm md:text-base flex items-center gap-2">
                   <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded text-xs break-keep">1단계</span> 
                   <span className="break-keep">기초 채우기</span>
                </h3>
                <div className="space-y-2.5 text-xs md:text-sm font-mono font-medium text-gray-700">
                  {worksheet.lvl1.map((q, i) => (
                    <p key={q.id}>
                      <span className="inline-block w-5 text-gray-400">{i+1})</span> 
                      {q.a} &nbsp;×&nbsp; {q.b} &nbsp;=&nbsp; {q.blank === 'c' ? '(      )' : q.c}
                    </p>
                  ))}
                </div>
              </div>
              
              {/* Level 2 */}
              <div className="border-[1.5px] border-dashed border-gray-300 p-4 md:p-5 rounded-2xl bg-gray-50/50">
                <h3 className="font-bold mb-4 text-green-600 text-sm md:text-base flex items-center gap-2">
                   <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded text-xs break-keep">2단계</span> 
                   <span className="break-keep">중간 비우기</span>
                </h3>
                <div className="space-y-2.5 text-xs md:text-sm font-mono font-medium text-gray-700">
                  {worksheet.lvl2.map((q, i) => (
                    <p key={q.id}>
                      <span className="inline-block w-5 text-gray-400">{i+1})</span> 
                      {q.blank === 'a' ? '(      )' : q.a} &nbsp;×&nbsp; 
                      {q.blank === 'b' ? '(      )' : q.b} &nbsp;=&nbsp; 
                      {q.blank === 'c' ? '(      )' : q.c}
                    </p>
                  ))}
                </div>
              </div>

              {/* Level 3 */}
              <div className="border-[1.5px] border-dashed border-gray-300 p-4 md:p-5 rounded-2xl col-span-1 md:col-span-2 print:col-span-2 bg-gray-50/50">
                <h3 className="font-bold mb-4 text-red-600 text-sm md:text-base flex items-center gap-2">
                   <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs break-keep">3단계</span> 
                   <span className="break-keep">심화 도전 (랜덤)</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-xs md:text-sm font-mono font-medium text-gray-700">
                  {worksheet.lvl3.map((q, i) => (
                    <p key={q.id}>
                      <span className="inline-block w-6 text-gray-400">{i+1})</span> 
                      {q.blank === 'a' ? '(      )' : q.a} &nbsp;×&nbsp; 
                      {q.blank === 'b' ? '(      )' : q.b} &nbsp;=&nbsp; 
                      {q.blank === 'c' ? '(      )' : q.c}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center">
              <div className="flex gap-4 items-center">
                <span className="text-[11px] md:text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded">자기 평가</span>
                <span className="text-xl md:text-2xl grayscale opacity-40">🙂</span>
                <span className="text-xl md:text-2xl grayscale opacity-40">😐</span>
                <span className="text-xl md:text-2xl grayscale opacity-40">🙁</span>
              </div>
              <div className="text-[10px] md:text-[11px] text-gray-500 font-semibold tracking-wide">부모님 및 선생님 확인 : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (인)</div>
            </div>
        </div>
      </div>

    </div>
  );
}
