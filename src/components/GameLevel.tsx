import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GameUnit, WordItem } from '../types';
import { usePoseLandmarker } from '../hooks/usePoseLandmarker';
import { COLLISION_THRESHOLD } from '../constants';
import { speak, playSoundEffect } from '../services/soundService';

interface GameLevelProps {
  unit: GameUnit;
  onExit: () => void;
  numPlayers: number;
  gameMode: 'classic' | 'translation';
}

interface Explosion {
  id: number;
  x: number;
  y: number;
}

const generateOptions = (allWords: WordItem[], correctWord: WordItem): WordItem[] => {
  const others = allWords.filter((w) => w.id !== correctWord.id);
  const shuffledOthers = others.sort(() => 0.5 - Math.random()).slice(0, 2);
  return [...shuffledOthers, correctWord].sort(() => 0.5 - Math.random());
};

const FireworkBurst: React.FC<{ x: number; y: number }> = React.memo(({ x, y }) => {
  const particles = useMemo(() => {
    return Array.from({ length: 60 }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 100 + Math.random() * 200;
      const tx = Math.cos(angle) * velocity + 'px';
      const ty = Math.sin(angle) * velocity + 'px';
      const rot = Math.random() * 720 + 'deg';
      const colors = ['#FFD700', '#FF4500', '#00BFFF', '#32CD32', '#FF69B4', '#F0F8FF', '#9370DB', '#00FF7F'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const shape = Math.random() > 0.5 ? '50%' : '2px';
      const size = 8 + Math.random() * 8; 
      return { i, tx, ty, rot, color, shape, size };
    });
  }, []);

  return (
    <div className="absolute z-[70] pointer-events-none" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>
      {particles.map((p) => (
        <div key={p.i} className="paper-particle" style={{ '--tx': p.tx, '--ty': p.ty, '--rot': p.rot, '--bg-color': p.color, borderRadius: p.shape, width: `${p.size}px`, height: `${p.size}px` } as React.CSSProperties} />
      ))}
    </div>
  );
});

const GameLevel: React.FC<GameLevelProps> = ({ unit, onExit, numPlayers, gameMode }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { landmarks, isLoading } = usePoseLandmarker(videoRef);
  
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([0, 0]);
  const [gameState, setGameState] = useState<'playing' | 'feedback_correct' | 'feedback_wrong'>('playing');
  const [options, setOptions] = useState<WordItem[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [winner, setWinner] = useState<number | null>(null);
  const [wrongSelectionId, setWrongSelectionId] = useState<string | null>(null);
  const [explosions, setExplosions] = useState<Explosion[]>([]);

  // --- NEW: DYNAMIC CAMERA LOGIC ---
  const [cameraSmooth, setCameraSmooth] = useState({ x: 0.5, y: 0.5, zoom: 1 });

  const sortedLandmarks = useMemo(() => {
    if (landmarks.length === 0) return [];
    return [...landmarks].sort((a, b) => (1 - (a[0]?.x || 0.5)) - (1 - (b[0]?.x || 0.5)));
  }, [landmarks]);

  useEffect(() => {
    if (sortedLandmarks.length > 0) {
      // Calculate center of all players
      const allX = sortedLandmarks.map(p => 1 - p[0].x);
      const allY = sortedLandmarks.map(p => p[0].y);
      const targetX = allX.reduce((a, b) => a + b, 0) / allX.length;
      const targetY = allY.reduce((a, b) => a + b, 0) / allY.length;

      // Calculate Zoom based on player spread
      let targetZoom = 1.3; // Default zoom in
      if (numPlayers > 1 && sortedLandmarks.length > 1) {
        const dist = Math.abs((1 - sortedLandmarks[0][0].x) - (1 - sortedLandmarks[1][0].x));
        targetZoom = Math.max(1, 1.4 - dist); // Zoom out as they move apart
      }

      // Simple Lerp for smoothing
      setCameraSmooth(prev => ({
        x: prev.x + (targetX - prev.x) * 0.1,
        y: prev.y + (targetY - prev.y) * 0.1,
        zoom: prev.zoom + (targetZoom - prev.zoom) * 0.1
      }));
    }
  }, [sortedLandmarks, numPlayers]);

  const cameraTransform = {
    transform: `scale(${cameraSmooth.zoom}) translate(${(0.5 - cameraSmooth.x) * 30}%, ${(0.5 - cameraSmooth.y) * 20}%)`,
    transition: 'transform 0.1s linear'
  };

  // --- END CAMERA LOGIC ---

  const currentTarget = useMemo(() => unit.words[currentWordIndex], [unit, currentWordIndex]);

  useEffect(() => {
    if (currentTarget) {
      setOptions(generateOptions(unit.words, currentTarget));
      const timer = setTimeout(() => {
         gameMode === 'translation' ? speak(`Find ${currentTarget.english}`, 'en-US') : speak(`请找 ${currentTarget.word}`, 'zh-CN', 0.9, currentTarget.soundAudio);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentTarget, unit.words, gameMode]);

  useEffect(() => {
    const setupCamera = async () => {
      if (navigator.mediaDevices?.getUserMedia && videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' }, audio: false });
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => videoRef.current?.play();
        } catch (err) { console.error("Camera error:", err); }
      }
    };
    setupCamera();
  }, []);

  useEffect(() => {
    if (gameState !== 'playing' || sortedLandmarks.length === 0) return;
    for (let playerIdx = 0; playerIdx < numPlayers; playerIdx++) {
        const playerLandmarks = sortedLandmarks[playerIdx];
        if (!playerLandmarks) continue;
        const nose = playerLandmarks[0];
        if (nose && nose.visibility > 0.5) {
            const headX = 1 - nose.x;
            const headY = nose.y - 0.10; 
            options.forEach((opt, boxIdx) => {
                let boxCX = 0.5;
                const boxCY = 0.3;
                if (numPlayers === 1) {
                    if (boxIdx === 0) boxCX = 0.2;
                    if (boxIdx === 1) boxCX = 0.5;
                    if (boxIdx === 2) boxCX = 0.8;
                } else {
                    const zoneWidth = 0.5;
                    const offset = playerIdx === 0 ? 0 : 0.5;
                    boxCX = offset + ((boxIdx * 2 + 1) / 6 * zoneWidth);
                }
                const dx = headX - boxCX;
                const dy = headY - boxCY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < (numPlayers === 1 ? COLLISION_THRESHOLD : COLLISION_THRESHOLD * 0.8)) {
                   handleSelection(opt, playerIdx, boxCX, boxCY);
                }
            });
        }
    }
  }, [sortedLandmarks, gameState, options, numPlayers]);

  const handleSelection = (selected: WordItem, playerIdx: number, x: number, y: number) => {
    if (gameState !== 'playing') return;
    if (selected.id === currentTarget.id) {
      setGameState('feedback_correct');
      setWinner(playerIdx);
      const newScores = [...scores];
      newScores[playerIdx] += 1;
      setScores(newScores);
      setFeedbackMessage(numPlayers > 1 ? `玩家 ${playerIdx + 1} 赢了!` : '太棒了!');
      const newExplosion = { id: Date.now(), x, y };
      setExplosions((prev) => [...prev, newExplosion]);
      setTimeout(() => setExplosions((prev) => prev.filter((e) => e.id !== newExplosion.id)), 1500);
      playSoundEffect('correct');
      speak(`找到 ${selected.word}`, 'zh-CN', 1.0, selected.soundAudio);
      setTimeout(() => {
        if (currentWordIndex < unit.words.length - 1) {
          setCurrentWordIndex(prev => prev + 1);
          setGameState('playing');
        } else {
          setFeedbackMessage('单元完成!');
          setTimeout(onExit, 4000);
        }
        setWinner(null);
        setWrongSelectionId(null);
      }, 2500);
    } else {
      setGameState('feedback_wrong');
      setWrongSelectionId(selected.id);
      setFeedbackMessage('再试一次!');
      playSoundEffect('wrong');
      speak("再试一次!", 'zh-CN');
      setTimeout(() => {
        setGameState('playing');
        setWrongSelectionId(null);
      }, 1200);
    }
  };

  const promptText = gameState === 'playing' ? (gameMode === 'translation' ? `Find: ${currentTarget.english}` : `Target: ${currentTarget.english}`) : feedbackMessage;

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
        {isLoading && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center bg-white">
                <div className="text-2xl font-bold animate-pulse">正在加载 AI 视觉... 🤖</div>
            </div>
        )}

        {/* --- LAYER 1: THE CAMERA (ZOOMING) --- */}
        <div className="absolute inset-0 z-0 bg-gray-900" style={cameraTransform}>
            <video ref={videoRef} className="w-full h-full object-cover transform -scale-x-100" playsInline muted />
            <div className="absolute inset-0 bg-[#6b8cff]/40 mix-blend-multiply" />
        </div>

        {/* --- LAYER 2: GAME WORLD (STATIC) --- */}
        <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="absolute top-20 left-[10%] opacity-40 text-8xl">☁️</div>
            <div className="absolute top-40 right-[15%] opacity-30 text-7xl">☁️</div>
            <div className="absolute bottom-0 w-full h-32 flex items-end opacity-60">
                <div className="w-full h-24 bg-green-500 rounded-t-[5rem]" />
            </div>
        </div>

        {/* --- LAYER 3: INTERACTIVE UI (STAYS IN FRONT) --- */}
        <div className="absolute inset-0 z-50 pointer-events-none">
            {/* Top Bar */}
            <div className="p-4 flex justify-between items-start">
                <button onClick={onExit} className="pointer-events-auto bg-white/90 px-8 py-2 rounded-full font-bold shadow-lg border-2 border-gray-200">退出</button>
                <div className="flex gap-4">
                    {scores.map((s, i) => (numPlayers > i && <div key={i} className={`${i === 0 ? 'bg-red-100' : 'bg-green-100'} px-6 py-2 rounded-2xl font-bold shadow-md`}>P{i+1}: {s}</div>))}
                </div>
            </div>

            {/* Prompt */}
            <div className="text-center mt-12">
                <h2 className="text-5xl font-bold text-white drop-shadow-lg">{promptText}</h2>
            </div>

            {/* Target Boxes */}
            <div className="relative h-full w-full">
                {options.map((opt, boxIdx) => {
                    let leftPos = "50%";
                    if (numPlayers === 1) leftPos = boxIdx === 0 ? "20%" : boxIdx === 1 ? "50%" : "80%";
                    else leftPos = `${(boxIdx < 3 ? (boxIdx * 2 + 1) / 6 * 50 : 50)}%`; // Simplified for example

                    return (
                        <div key={opt.id} className={`absolute top-[35%] -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/95 rounded-3xl shadow-2xl flex items-center justify-center transition-all ${gameState === 'feedback_wrong' && opt.id === wrongSelectionId ? 'animate-shake' : ''}`} style={{ left: leftPos }}>
                            <span className="text-4xl font-black">{opt.word}</span>
                        </div>
                    );
                })}
            </div>

            {/* Avatars (Mushroom) */}
            {sortedLandmarks.slice(0, numPlayers).map((poses, idx) => {
                const nose = poses[0];
                if (!nose || nose.visibility <= 0.5) return null;
                return (
                    <div key={idx} className="absolute transform -translate-x-1/2 -translate-y-1/2" style={{ left: `${(1 - nose.x) * 100}%`, top: `${nose.y * 100}%` }}>
                        <span className="text-8xl" style={{ filter: idx === 1 ? "hue-rotate(90deg)" : "" }}>🍄</span>
                    </div>
                );
            })}
        </div>
        {explosions.map(exp => <FireworkBurst key={exp.id} x={exp.x} y={exp.y} />)}
    </div>
  );
};

export default GameLevel;
