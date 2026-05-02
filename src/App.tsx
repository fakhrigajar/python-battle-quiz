/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy,
  Play,
  RotateCcw,
  Home,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Users,
} from "lucide-react";

// --- Types ---

interface Question {
  id: string;
  text: string;
  answer: string;
  points?: number;
  options?: string[];
  rangeHint?: number;
}

enum Screen {
  Home = "home",
  Quiz = "quiz",
  Points = "points",
}

// --- Utils ---

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const pickRandom = <T,>(list: T[]): T => list[randomInt(0, list.length - 1)];
const shuffle = <T,>(list: T[]): T[] => {
  const clone = [...list];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
};

// --- Question Generators ---

const createNearbyNumbers = (correct: string | number, rangeHint = 10) => {
  const num = Number(correct);
  const wrongs = new Set<string>();
  const maxDelta = Math.max(4, Math.floor(rangeHint / 3));
  while (wrongs.size < 3) {
    const delta = randomInt(1, maxDelta);
    const sign = Math.random() < 0.5 ? -1 : 1;
    const candidateNumber = Math.max(0, num + sign * delta);
    const candidate = String(candidateNumber);
    if (candidate !== String(correct)) {
      wrongs.add(candidate);
    }
  }
  return Array.from(wrongs);
};

const makeAddQuestion = (maxNum: number) => {
  const a = randomInt(5, maxNum);
  const b = randomInt(5, maxNum);
  return {
    id: `q_add_${Date.now()}_${Math.random()}`,
    text: `# Add numbers\nx = ${a}\ny = ${b}\nprint(x + y)\n# What is the output?`,
    answer: String(a + b),
    rangeHint: maxNum * 2,
  };
};

const makePowerQuestion = (maxBase: number, maxExp: number) => {
  const base = randomInt(2, maxBase);
  const exponent = randomInt(2, maxExp);
  return {
    id: `q_pow_${Date.now()}_${Math.random()}`,
    text: `# Exponent operator\nx = ${base}\ny = ${exponent}\nprint(x ** y)\n# What is the output?`,
    answer: String(base ** exponent),
    rangeHint: Math.max(20, base ** exponent),
  };
};

const makeAndQuestion = () => {
  const a = Math.random() < 0.5;
  const b = Math.random() < 0.5;
  return {
    id: `q_and_${Date.now()}_${Math.random()}`,
    text: `# Logical AND\na = ${a ? "True" : "False"}\nb = ${b ? "True" : "False"}\nprint(a and b)\n# What is the output?`,
    answer: String(a && b).toLowerCase(),
    rangeHint: 2,
  };
};

const makeOrQuestion = () => {
  const a = Math.random() < 0.5;
  const b = Math.random() < 0.5;
  return {
    id: `q_or_${Date.now()}_${Math.random()}`,
    text: `# Logical OR\na = ${a ? "True" : "False"}\nb = ${b ? "True" : "False"}\nprint(a or b)\n# What is the output?`,
    answer: String(a || b).toLowerCase(),
    rangeHint: 2,
  };
};

// --- Main Components ---

export default function App() {
  const [screen, setScreen] = useState<Screen>(Screen.Home);

  // Quiz State
  const [currentQuizQ, setCurrentQuizQ] = useState<Question | null>(null);
  const [quizResult, setQuizResult] = useState<{
    text: string;
    isOk: boolean;
  } | null>(null);
  const [quizCount, setQuizCount] = useState(0);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [canAnswer, setCanAnswer] = useState(true);

  // Points Game State
  const [pointsQuestions, setPointsQuestions] = useState<Question[]>([]);
  const [activeTeam, setActiveTeam] = useState<"A" | "B" | null>(null);
  const [teamPoints, setTeamPoints] = useState({ A: 0, B: 0 });
  const [selectedPQuestion, setSelectedPQuestion] = useState<Question | null>(
    null,
  );
  const [showPAnswer, setShowPAnswer] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);

  // Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);

  // --- Handlers ---

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playTone = (
    frequency: number,
    duration: number,
    type: OscillatorType,
    startTime: number,
    gainValue: number,
  ) => {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  };

  const playPip = () => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    playTone(440, 0.1, "sine", now, 0.1);
  };

  const playFinalPip = () => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    playTone(880, 0.3, "sine", now, 0.15);
  };

  const playCorrectSound = () => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    playTone(523.25, 0.16, "triangle", now, 0.12);
    playTone(659.25, 0.18, "triangle", now + 0.12, 0.12);
    playTone(783.99, 0.24, "triangle", now + 0.24, 0.14);
  };

  const playWrongSound = () => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    playTone(260, 0.2, "sine", now, 0.12);
    playTone(220, 0.22, "sine", now + 0.14, 0.11);
    playTone(174.61, 0.28, "sine", now + 0.28, 0.1);
  };

  // --- Timer Effect ---
  useEffect(() => {
    let timer: number;
    if (selectedPQuestion && !showPAnswer && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => {
          const next = prev - 1;
          if (next <= 3 && next > 0) {
            playPip();
          } else if (next === 0) {
            playFinalPip();
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [selectedPQuestion, showPAnswer, timeLeft]);

  // --- Quiz Logic ---

  const generateQuizQuestion = () => {
    const generators = [
      () => makeAddQuestion(30),
      () => makePowerQuestion(5, 2),
      () => makeAndQuestion(),
      () => makeOrQuestion(),
    ];
    const q = pickRandom(generators)();
    const opts =
      q.answer === "true" || q.answer === "false"
        ? shuffle(["true", "false"])
        : shuffle([q.answer, ...createNearbyNumbers(q.answer, q.rangeHint)]);

    setCurrentQuizQ(q);
    setQuizOptions(opts);
    setQuizResult(null);
    setCanAnswer(true);
    setQuizCount((prev) => prev + 1);
  };

  const handleQuizAnswer = (selected: string) => {
    if (!canAnswer || !currentQuizQ) return;
    setCanAnswer(false);

    if (selected.toLowerCase() === currentQuizQ.answer.toLowerCase()) {
      playCorrectSound();
      setQuizResult({ text: "Correct!", isOk: true });
      setTimeout(generateQuizQuestion, 1000);
    } else {
      playWrongSound();
      setQuizResult({
        text: `Incorrect. The answer was ${currentQuizQ.answer}.`,
        isOk: false,
      });
    }
  };

  // --- Points Game Logic ---

  const initPointsGame = () => {
    const baseQuestions = [
      { points: 5, ...makeAddQuestion(20) },
      { points: 5, ...makeAddQuestion(30) },
      { points: 10, ...makePowerQuestion(6, 2) },
      { points: 10, ...makeAddQuestion(50) },
      { points: 15, ...makeAndQuestion() },
      { points: 15, ...makeOrQuestion() },
      { points: 20, ...makePowerQuestion(3, 4) },
      { points: 20, ...makeAddQuestion(100) },
      { points: 25, ...makePowerQuestion(2, 6) },
      { points: 25, ...makeAddQuestion(150) },
    ];
    setPointsQuestions(shuffle(baseQuestions));
    setTeamPoints({ A: 0, B: 0 });
    setActiveTeam(null);
    setScreen(Screen.Points);
  };

  const handlePointResult = (isCorrect: boolean) => {
    if (!selectedPQuestion || !activeTeam) return;
    const points = selectedPQuestion.points || 0;
    const delta = isCorrect ? points : -points;

    setTeamPoints((prev) => ({
      ...prev,
      [activeTeam]: Math.min(100, Math.max(0, prev[activeTeam] + delta)),
    }));

    setPointsQuestions((prev) =>
      prev.map((q) =>
        q.id === selectedPQuestion.id ? { ...q, used: true } : q,
      ),
    );
    setSelectedPQuestion(null);
    setShowPAnswer(false);
  };

  // --- Styling Helpers ---

  const renderCode = (text: string) => {
    return text.split("\n").map((line, i) => {
      const isComment = line.trimStart().startsWith("#");
      return (
        <div
          key={i}
          className={isComment ? "text-[#6a9955]" : "text-[#d1d5db]"}
        >
          {line}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="atmosphere">
        <div className="blur-spot-a" />
        <div className="blur-spot-b" />
        <div className="grid-overlay" />
      </div>

      <div className="relative z-10 w-full max-w-[1500px] flex flex-col xl:flex-row items-center justify-center gap-12 xl:gap-16">
        <AnimatePresence mode="wait">
          {screen === Screen.Points && (
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="flank-team left hidden xl:block"
            >
              <div className="flank-label text-blue-400">Home Team</div>
              <h2 className="flank-name">
                TEAM
                <br />
                <span className="text-blue-500">ALPHA</span>
              </h2>
              <div className="h-[2px] w-12 bg-blue-500 my-4" />
              <div
                className={`flank-score-card transition-all duration-300 ${activeTeam === "A" ? "ring-2 ring-blue-500 bg-blue-500/10" : ""}`}
              >
                <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">
                  Current Score
                </p>
                <p className="text-3xl font-black">{teamPoints.A}</p>
                <button
                  onClick={() => setActiveTeam("A")}
                  className={`mt-3 w-full py-2 rounded text-[10px] uppercase font-bold tracking-widest border transition-all ${activeTeam === "A" ? "bg-blue-500 border-blue-400 text-white" : "border-zinc-700 hover:border-zinc-500 text-zinc-400"}`}
                >
                  {activeTeam === "A" ? "ACTIVE" : "SELECT TEAM"}
                </button>
              </div>
            </motion.div>
          )}

          <div className="card">
            <AnimatePresence mode="wait">
              <motion.div
                key={screen}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {screen === Screen.Home && (
                  <div className="text-center">
                    <div className="inline-block px-3 py-1 bg-zinc-800 rounded-full text-[10px] font-bold tracking-[0.15em] text-zinc-400 mb-8 uppercase border border-zinc-700">
                      by Fakhri Gajar
                    </div>
                    <h1 className="text-5xl sm:text-6xl font-black italic tracking-tighter mb-4 text-white leading-none">
                      PYTHON
                      <br />
                      <span className="text-zinc-600">BATTLE</span>
                    </h1>
                    <p className="text-zinc-500 font-mono text-[10px] tracking-widest mb-10 uppercase">
                      Select combat mode to initiate
                    </p>

                    <div className="flex flex-col gap-4 max-w-xs mx-auto">
                      <button
                        onClick={() => {
                          setScreen(Screen.Quiz);
                          generateQuizQuestion();
                        }}
                        className="primary-btn flex items-center justify-center gap-2"
                      >
                        <Play size={14} fill="currentColor" /> Random Blitz
                      </button>
                      <button
                        onClick={initPointsGame}
                        className="secondary-btn flex items-center justify-center gap-2"
                      >
                        <Users size={14} /> Team Warfare
                      </button>
                    </div>
                  </div>
                )}

                {screen === Screen.Quiz && (
                  <div>
                    <div className="flex justify-between items-center mb-8">
                      <div>
                        <div className="text-[10px] font-bold tracking-widest text-blue-400 uppercase mb-1">
                          Blitz Challenge
                        </div>
                        <h2 className="text-2xl font-black italic uppercase text-white">
                          Question {quizCount}
                        </h2>
                      </div>
                      <button
                        onClick={() => setScreen(Screen.Home)}
                        className="p-3 bg-zinc-800/50 hover:bg-zinc-700 rounded-full text-zinc-300 transition-colors border border-zinc-700"
                      >
                        <Home size={18} />
                      </button>
                    </div>

                    <div className="code-editor-bg rounded-2xl overflow-hidden mb-8 shadow-2xl">
                      <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
                        <div className="flex gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-widest">
                          Logic.py
                        </span>
                      </div>
                      <div className="p-6 font-mono text-sm leading-relaxed min-h-[160px]">
                        {currentQuizQ && renderCode(currentQuizQ.text)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                      {quizOptions.map((opt, i) => (
                        <button
                          key={i}
                          disabled={!canAnswer}
                          onClick={() => handleQuizAnswer(opt)}
                          className={`p-4 rounded-xl border-2 text-center font-black text-xs uppercase tracking-widest transition-all ${
                            quizResult?.isOk &&
                            opt.toLowerCase() ===
                              currentQuizQ?.answer.toLowerCase()
                              ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                              : !quizResult?.isOk &&
                                  quizResult &&
                                  opt.toLowerCase() ===
                                    currentQuizQ?.answer.toLowerCase()
                                ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                                : quizResult &&
                                    !quizResult.isOk &&
                                    opt.toLowerCase() !==
                                      currentQuizQ?.answer.toLowerCase()
                                  ? "opacity-30 border-zinc-800 text-zinc-600 grayscale"
                                  : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800 text-white"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>

                    {quizResult && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center gap-3 p-4 rounded-xl font-bold text-[11px] uppercase tracking-widest mb-6 ${quizResult.isOk ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}
                      >
                        {quizResult.isOk ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <XCircle size={18} />
                        )}
                        {quizResult.text}
                      </motion.div>
                    )}

                    <div className="flex justify-between items-center pt-6 border-t border-zinc-800">
                      <span className="text-[10px] text-zinc-500 font-mono font-bold tracking-widest uppercase"></span>
                      {quizResult && !quizResult.isOk && (
                        <button
                          onClick={generateQuizQuestion}
                          className="flex items-center gap-2 text-white font-black text-xs uppercase tracking-widest hover:text-blue-400 transition-colors"
                        >
                          Next Question <ChevronRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {screen === Screen.Points && (
                  <div>
                    <div className="flex justify-between items-center mb-8">
                      <div>
                        <div className="text-[10px] font-bold tracking-widest text-rose-400 uppercase mb-1">
                          Combat Arena
                        </div>
                        <h2 className="text-2xl font-black italic uppercase text-white">
                          Points Warfare
                        </h2>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={initPointsGame}
                          className="p-3 bg-zinc-800/50 hover:bg-zinc-700 rounded-full text-zinc-400 border border-zinc-700 transition-colors"
                        >
                          <RotateCcw size={18} />
                        </button>
                        <button
                          onClick={() => setScreen(Screen.Home)}
                          className="p-3 bg-zinc-800/50 hover:bg-zinc-700 rounded-full text-zinc-400 border border-zinc-700 transition-colors"
                        >
                          <Home size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="flex xl:hidden gap-3 mb-8">
                      <button
                        onClick={() => setActiveTeam("A")}
                        className={`flex-1 p-4 rounded-2xl border-2 transition-all ${activeTeam === "A" ? "bg-blue-500/10 border-blue-500" : "bg-zinc-900 border-zinc-800"}`}
                      >
                        <div className="text-[10px] font-black text-blue-400 mb-1">
                          ALPHA
                        </div>
                        <div className="text-2xl font-black text-white">
                          {teamPoints.A}
                        </div>
                      </button>
                      <button
                        onClick={() => setActiveTeam("B")}
                        className={`flex-1 p-4 rounded-2xl border-2 transition-all ${activeTeam === "B" ? "bg-rose-500/10 border-rose-500" : "bg-zinc-900 border-zinc-800"}`}
                      >
                        <div className="text-[10px] font-black text-rose-400 mb-1">
                          BRAVO
                        </div>
                        <div className="text-2xl font-black text-white">
                          {teamPoints.B}
                        </div>
                      </button>
                    </div>

                    <div className="text-center mb-8">
                      <div className="inline-block px-4 py-2 bg-zinc-900 rounded-full border border-zinc-800 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                        {activeTeam
                          ? `Attacking Entity: Team ${activeTeam === "A" ? "Alpha" : "Bravo"}`
                          : "Initiate Team Selection"}
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-3">
                      {pointsQuestions.map((q) => (
                        <button
                          key={q.id}
                          disabled={q.used || !activeTeam}
                          onClick={() => {
                            setSelectedPQuestion(q);
                            setShowPAnswer(false);
                            setTimeLeft(20);
                          }}
                          className={`aspect-square flex flex-col items-center justify-center rounded-2xl border-2 font-black transition-all ${
                            q.used
                              ? "opacity-20 border-zinc-900 text-zinc-700 grayscale"
                              : !activeTeam
                                ? "border-zinc-900 opacity-40 text-zinc-600"
                                : "bg-zinc-900 border-zinc-800 hover:border-white hover:bg-zinc-800 text-white cursor-pointer active:scale-90"
                          }`}
                        >
                          <span className="text-lg leading-none">
                            {q.points}
                          </span>
                          <span className="text-[8px] mt-1 opacity-50 font-bold">
                            PTS
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* --- Right Side Team Flank --- */}
          {screen === Screen.Points && (
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="flank-team right hidden xl:block"
            >
              <div className="flank-label text-rose-400">Away Team</div>
              <h2 className="flank-name">
                TEAM
                <br />
                <span className="text-rose-500">BRAVO</span>
              </h2>
              <div className="h-[2px] w-12 bg-rose-500 my-4 ml-auto" />
              <div
                className={`flank-score-card transition-all duration-300 ${activeTeam === "B" ? "ring-2 ring-rose-500 bg-rose-500/10" : ""}`}
              >
                <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">
                  Current Score
                </p>
                <p className="text-3xl font-black">{teamPoints.B}</p>
                <button
                  onClick={() => setActiveTeam("B")}
                  className={`mt-3 w-full py-2 rounded text-[10px] uppercase font-bold tracking-widest border transition-all ${activeTeam === "B" ? "bg-rose-500 border-rose-400 text-white" : "border-zinc-700 hover:border-zinc-500 text-zinc-400"}`}
                >
                  {activeTeam === "B" ? "ACTIVE" : "SELECT TEAM"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedPQuestion && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[32px] w-full max-w-xl shadow-[0_0_80px_rgba(0,0,0,1)] overflow-hidden"
            >
              <div className="px-8 py-6 bg-zinc-800/50 border-b border-zinc-800 flex justify-between items-center">
                <div className="flex items-center gap-6">
                  <div>
                    <span
                      className={`text-sm font-black uppercase tracking-widest ${activeTeam === "A" ? "text-blue-400" : "text-rose-400"}`}
                    >
                      Team {activeTeam === "A" ? "Alpha" : "Bravo"} •{" "}
                      {selectedPQuestion.points} Points
                    </span>
                  </div>
                  {!showPAnswer && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        Time:
                      </span>
                      <span
                        className={`text-xl font-mono font-black ${timeLeft <= 3 ? "text-rose-500 animate-pulse" : "text-white"}`}
                      >
                        {String(timeLeft).padStart(2, "0")}s
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedPQuestion(null)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="p-8">
                <div className="bg-black p-8 rounded-2xl font-mono text-sm leading-relaxed border border-zinc-800 mb-8 min-h-[160px] shadow-inner">
                  {renderCode(selectedPQuestion.text)}
                </div>

                {showPAnswer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mb-8 p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-black text-center text-sm tracking-[0.2em]"
                  >
                    ANSWER: {selectedPQuestion.answer.toUpperCase()}
                  </motion.div>
                )}

                <div className="flex flex-col gap-4">
                  {!showPAnswer ? (
                    <button
                      onClick={() => setShowPAnswer(true)}
                      className="w-full primary-btn"
                    >
                      Show Data
                    </button>
                  ) : (
                    <div className="flex gap-4">
                      <button
                        onClick={() => handlePointResult(true)}
                        className="flex-1 py-4 rounded-full bg-emerald-500 text-black font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        Correct(+)
                      </button>
                      <button
                        onClick={() => handlePointResult(false)}
                        className="flex-1 py-4 rounded-full bg-rose-500 text-white font-black text-xs uppercase tracking-[0.2em] hover:bg-rose-400 transition-all shadow-lg shadow-rose-500/20"
                      >
                        Wrong(-)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Add a dummy interface for type compatibility with older TS in some environments
interface OscillatorTypeOverride {
  type: OscillatorType;
}
