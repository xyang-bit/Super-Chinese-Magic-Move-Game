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

// Helper to get random options including the correct one
const generateOptions = (allWords: WordItem[], correctWord: WordItem): WordItem[] => {
    const others = allWords.filter((w) => w.id !== correctWord.id);
    const shuffledOthers = others.sort(() => 0.5 - Math.random()).slice(0, 2);
    return [...shuffledOthers, correctWord].sort(() => 0.5 - Math.random());
};

// Component for a single confetti burst
const FireworkBurst: React.FC<{ x: number; y: number }> = React.memo(({ x, y }) => {
    // Generate random particles
    const particles = useMemo(() => {
        return Array.from({ length: 40 }).map((_, i) => {
            const angle = Math.random() * Math.PI * 2;
            const velocity = 80 + Math.random() * 150; // spread distance
            const tx = Math.cos(angle) * velocity + 'px';
            const ty = Math.sin(angle) * velocity + 'px';
            const rot = Math.random() * 720 + 'deg';
            const colors = ['#FFD700', '#FF4500', '#00BFFF', '#32CD32', '#FF69B4', '#F0F8FF'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            return { i, tx, ty, rot, color };
        });
    }, []);

    return (
        <div className="absolute z-[70] pointer-events-none" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>
            {particles.map((p) => (
                <div
                    key={p.i}
                    className="paper-particle"
                    style={{
                        '--tx': p.tx,
                        '--ty': p.ty,
                        '--rot': p.rot,
                        '--bg-color': p.color,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
});

const GameLevel: React.FC<GameLevelProps> = ({ unit, onExit, numPlayers, gameMode }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { landmarks, isLoading } = usePoseLandmarker(videoRef);

    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [scores, setScores] = useState<number[]>([0, 0]); // [P1 Score, P2 Score]
    const [gameState, setGameState] = useState<'playing' | 'feedback_correct' | 'feedback_wrong'>('playing');
    const [options, setOptions] = useState<WordItem[]>([]);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [winner, setWinner] = useState<number | null>(null); // 0 for P1, 1 for P2
    const [wrongSelectionId, setWrongSelectionId] = useState<string | null>(null);
    const [explosions, setExplosions] = useState<Explosion[]>([]);

    // --- Dynamic Camera State ---
    const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
    const targetCamera = useRef({ x: 0, y: 0, scale: 1 });
    const requestRef = useRef<number | null>(null);

    const currentTarget = useMemo(() => unit.words[currentWordIndex], [unit, currentWordIndex]);

    // Sort landmarks spatially (Left-to-Right on screen) to ensure P1 is always Left and P2 is Right
    const sortedLandmarks = useMemo(() => {
        if (landmarks.length === 0) return [];
        // Clone and sort based on screen X (1 - nose.x because of mirroring)
        return [...landmarks].sort((a, b) => {
            const ax = 1 - (a[0]?.x || 0.5);
            const bx = 1 - (b[0]?.x || 0.5);
            return ax - bx;
        });
    }, [landmarks]);

    // Setup options
    useEffect(() => {
        if (currentTarget) {
            setOptions(generateOptions(unit.words, currentTarget));
            const timer = setTimeout(() => {
                if (gameMode === 'translation') {
                    // In translation mode, we speak the English word (Target is Chinese, prompt is English)
                    // Or usually: "Find [English]" -> User looks for Chinese options.
                    // If prompt is English, we don't use the custom Chinese audio for the prompt.
                    speak(`Find ${currentTarget.english}`, 'en-US');
                } else {
                    // Classic mode: Speak Chinese. Use custom audio if available.
                    speak(`请找 ${currentTarget.word}`, 'zh-CN', 0.9, currentTarget.soundAudio);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [currentTarget, unit.words, gameMode]);

    // Setup Camera
    useEffect(() => {
        const setupCamera = async () => {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && videoRef.current) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { width: 1280, height: 720, facingMode: 'user' },
                        audio: false,
                    });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
                    }
                } catch (err) {
                    console.error("Camera error:", err);
                    alert("Could not access camera. Please allow camera permissions.");
                }
            }
        };
        setupCamera();
    }, []);

    // --- Dynamic Camera Logic ---
    // 1. Calculate Bounding Box and Target Camera State
    useEffect(() => {
        if (sortedLandmarks.length === 0) {
            targetCamera.current = { x: 0, y: 0, scale: 1 };
            return;
        }

        // Get bounds of all active players' noses
        let minX = 1, maxX = 0, minY = 1, maxY = 0;
        let count = 0;

        sortedLandmarks.slice(0, numPlayers).forEach(landmarks => {
            const nose = landmarks[0];
            if (nose && nose.visibility > 0.5) {
                const headX = 1 - nose.x; // Mirrored
                const headY = nose.y;
                minX = Math.min(minX, headX);
                maxX = Math.max(maxX, headX);
                minY = Math.min(minY, headY);
                maxY = Math.max(maxY, headY);
                count++;
            }
        });

        if (count === 0) {
            targetCamera.current = { x: 0, y: 0, scale: 1 };
            return;
        }

        // Calculate center and spread
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const dx = maxX - minX;
        const dy = maxY - minY;

        // Determine zoom level based on spread (how far apart players are)
        // Base scale is 1.2 to 1.8. Closer players = higher scale.
        // We want some margin around players.
        const margin = 0.4;
        const spread = Math.max(dx, dy, 0.2); // Don't zoom in TOO much on one person
        let newScale = 1 / (spread + margin);
        newScale = Math.min(Math.max(newScale, 1), 2.2); // Clamp between 1.0x and 2.2x

        // Panning: Offset is how far to move the "world" to keep centerX at screen center (0.5)
        // translate = (0.5 - centerX) * scale * 100%
        const targetX = (0.5 - centerX) * 100 * newScale;
        const targetY = (0.4 - centerY) * 100 * newScale; // Keep players slightly above center

        targetCamera.current = { x: targetX, y: targetY, scale: newScale };
    }, [sortedLandmarks, numPlayers]);

    // 2. Smooth Interpolation (Lerp) Loop
    useEffect(() => {
        const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

        const animate = () => {
            setCamera(prev => ({
                x: lerp(prev.x, targetCamera.current.x, 0.1),
                y: lerp(prev.y, targetCamera.current.y, 0.1),
                scale: lerp(prev.scale, targetCamera.current.scale, 0.1),
            }));
            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    // Collision Loop
    useEffect(() => {
        if (gameState !== 'playing' || sortedLandmarks.length === 0) return;

        // Check each player index (0 = P1/Left, 1 = P2/Right)
        for (let playerIdx = 0; playerIdx < numPlayers; playerIdx++) {
            // Use sorted landmarks to ensure Left Person controls P1
            const playerLandmarks = sortedLandmarks[playerIdx];
            if (!playerLandmarks) continue;

            // 0: Nose (Head tracking)
            const nose = playerLandmarks[0];

            if (nose && nose.visibility > 0.5) {
                const headX = 1 - nose.x; // Mirroring
                // Collision point is the Mushroom (Forehead), which is visually offset by 10% height above nose
                const headY = nose.y - 0.10;

                // Define box centers
                options.forEach((opt, boxIdx) => {
                    let boxCX = 0.5;
                    const boxCY = 0.3; // Raised slightly

                    if (numPlayers === 1) {
                        if (boxIdx === 0) boxCX = 0.2;
                        if (boxIdx === 1) boxCX = 0.5;
                        if (boxIdx === 2) boxCX = 0.8;
                    } else {
                        const zoneWidth = 0.5;
                        const offset = playerIdx === 0 ? 0 : 0.5;
                        const relPos = (boxIdx * 2 + 1) / 6;
                        boxCX = offset + (relPos * zoneWidth);
                    }

                    const dx = headX - boxCX;
                    const dy = headY - boxCY;
                    const threshold = numPlayers === 1 ? COLLISION_THRESHOLD : COLLISION_THRESHOLD * 0.8;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < threshold) {
                        handleSelection(opt, playerIdx, boxCX, boxCY);
                    }
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortedLandmarks, gameState, options, numPlayers]);

    const handleSelection = (selected: WordItem, playerIdx: number, x: number, y: number) => {
        if (gameState !== 'playing') return; // Prevent double trigger

        if (selected.id === currentTarget.id) {
            // Correct!
            setGameState('feedback_correct');
            setWinner(playerIdx);

            const newScores = [...scores];
            newScores[playerIdx] += 1;
            setScores(newScores);

            const winMsg = numPlayers > 1 ? `玩家 ${playerIdx + 1} 赢了!` : '太棒了!';
            setFeedbackMessage(winMsg);

            // TRIGGER EXPLOSION
            const newExplosion = { id: Date.now(), x, y };
            setExplosions((prev) => [...prev, newExplosion]);
            // Cleanup explosion
            setTimeout(() => {
                setExplosions((prev) => prev.filter((e) => e.id !== newExplosion.id));
            }, 1000);

            playSoundEffect('correct');

            // Feedback: Speak "Found [Word]"
            // Use custom audio if available
            speak(`找到 ${selected.word}`, 'zh-CN', 1.0, selected.soundAudio);

            setTimeout(() => {
                nextLevel();
            }, 2000);
        } else {
            // Wrong
            setGameState('feedback_wrong');
            setWrongSelectionId(selected.id);
            setFeedbackMessage('再试一次!');
            playSoundEffect('wrong');
            speak("再试一次!", 'zh-CN');

            setTimeout(() => {
                setGameState('playing');
                setFeedbackMessage('');
                setWinner(null);
                setWrongSelectionId(null);
            }, 1000);
        }
    };

    const nextLevel = () => {
        setWinner(null);
        setWrongSelectionId(null);
        if (currentWordIndex < unit.words.length - 1) {
            setCurrentWordIndex(prev => prev + 1);
            setGameState('playing');
            setFeedbackMessage('');
        } else {
            setFeedbackMessage('单元完成!');

            let finalMsg = "单元完成!";
            if (numPlayers > 1) {
                if (scores[0] > scores[1]) finalMsg = "玩家一赢了!";
                else if (scores[1] > scores[0]) finalMsg = "玩家二赢了!";
                else finalMsg = "平局!";
            }
            speak(finalMsg, 'zh-CN');
            setTimeout(onExit, 4000);
        }
    };

    // Determine what text to show on screen for prompt
    const promptText = gameState === 'playing'
        ? (gameMode === 'translation' ? `Find: ${currentTarget.english}` : `Target: ${currentTarget.english}`)
        : feedbackMessage;

    return (
        <div className="fixed inset-0 bg-black flex flex-col">
            {isLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white">
                    <div className="text-2xl font-bold animate-pulse">正在加载 AI 视觉... 🤖</div>
                </div>
            )}

            {/* Top UI Bar */}
            <div className="absolute top-0 left-0 right-0 z-30 p-4 pointer-events-none">
                {/* Center Exit Button */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2">
                    <button
                        onClick={onExit}
                        className="pointer-events-auto bg-white/90 text-gray-800 px-8 py-2 rounded-full font-bold shadow-lg hover:bg-white transition-transform active:scale-95 border-2 border-gray-200"
                    >
                        退出
                    </button>
                </div>

                {/* Scoreboard */}
                <div className={`flex ${numPlayers > 1 ? 'justify-between w-full px-8' : 'justify-end pr-4'}`}>
                    {/* P1 Score */}
                    <div className={`bg-red-100 text-red-900 px-6 py-3 rounded-2xl font-bold shadow-lg border-b-4 border-red-300 flex items-center gap-3 ${numPlayers === 1 ? 'hidden' : ''}`}>
                        <span className="text-3xl">🍄</span>
                        <div className="flex flex-col leading-none">
                            <span className="text-xs uppercase opacity-70">玩家 1</span>
                            <span className="text-3xl">{scores[0]}</span>
                        </div>
                    </div>

                    {/* Single Player Score */}
                    {numPlayers === 1 && (
                        <div className="bg-red-100 text-red-900 px-6 py-3 rounded-2xl font-bold shadow-lg border-b-4 border-red-300 flex items-center gap-3">
                            <span className="text-3xl">🍄</span>
                            <span className="text-3xl">{scores[0]}</span>
                        </div>
                    )}

                    {/* P2 Score */}
                    {numPlayers > 1 && (
                        <div className="bg-green-100 text-green-900 px-6 py-3 rounded-2xl font-bold shadow-lg border-b-4 border-green-300 flex items-center gap-3">
                            <div className="flex flex-col leading-none items-end">
                                <span className="text-xs uppercase opacity-70">玩家 2</span>
                                <span className="text-3xl">{scores[1]}</span>
                            </div>
                            <span className="text-3xl filter hue-rotate-90">🍄</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Prompt */}
            <div className="absolute top-24 left-0 right-0 z-20 text-center pointer-events-none">
                <h2 className="text-4xl md:text-5xl font-bold text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
                    {promptText}
                </h2>
                {gameState === 'playing' && (
                    <p className="text-white/90 text-xl font-bold mt-2 animate-pulse">
                        {numPlayers > 1 ? "谁先碰到谁赢！" : "用你的蘑菇去碰！"}
                    </p>
                )}
            </div>

            {/* Game Area */}
            <div className="relative flex-1 w-full h-full overflow-hidden bg-gray-900">

                {/* TRANSFORM CONTAINER (The World) */}
                <div
                    className="absolute inset-0 w-full h-full transition-transform duration-0"
                    style={{
                        transform: `scale(${camera.scale}) translate(${camera.x / camera.scale}%, ${camera.y / camera.scale}%)`,
                        transformOrigin: 'center center'
                    }}
                >
                    <video
                        ref={videoRef}
                        className="absolute w-full h-full object-cover transform -scale-x-100"
                        playsInline
                        muted
                    />

                    {/* Render Boxes (Inside Transformed World) */}
                    {!isLoading && (
                        <>
                            {Array.from({ length: numPlayers }).map((_, pIndex) => (
                                <div key={`p-zone-${pIndex}`} className="contents">
                                    {options.map((opt, boxIdx) => {
                                        let leftPct = '50%';
                                        if (numPlayers === 1) {
                                            if (boxIdx === 0) leftPct = '20%';
                                            if (boxIdx === 1) leftPct = '50%';
                                            if (boxIdx === 2) leftPct = '80%';
                                        } else {
                                            const zoneWidth = 50;
                                            const offset = pIndex === 0 ? 0 : 50;
                                            const relPos = (boxIdx * 2 + 1) / 6;
                                            leftPct = `${offset + (relPos * zoneWidth)}%`;
                                        }

                                        let extraClasses = "";
                                        let opacity = "opacity-100";
                                        if (gameState === 'feedback_correct' && opt.id === currentTarget.id) {
                                            if (winner === pIndex || winner === null) {
                                                extraClasses = "animate-celebrate bg-yellow-200 border-yellow-500 ring-8 ring-yellow-300 z-50 scale-125";
                                            } else {
                                                opacity = "opacity-50 grayscale";
                                            }
                                        } else if (gameState === 'feedback_wrong') {
                                            if (opt.id === wrongSelectionId) {
                                                extraClasses = "animate-shake bg-red-200 border-red-500 ring-4 ring-red-400 z-50";
                                            } else {
                                                opacity = "opacity-40 scale-90";
                                            }
                                        } else if (gameState === 'feedback_correct' && opt.id !== currentTarget.id) {
                                            opacity = "opacity-20 scale-75";
                                        }

                                        const sizeClasses = numPlayers === 1 ? "w-32 h-32 md:w-48 md:h-48" : "w-24 h-24 md:w-32 md:h-32";

                                        return (
                                            <div
                                                key={`p${pIndex}-opt${opt.id}`}
                                                className={`absolute top-[30%] -translate-x-1/2 -translate-y-1/2 
                                                    ${sizeClasses}
                                                    bg-white/95 rounded-3xl shadow-2xl border-b-8 border-gray-200
                                                    flex flex-col items-center justify-center
                                                    transition-all duration-300 ease-out
                                                    ${gameState === 'playing' ? 'hover:scale-105' : ''}
                                                    ${extraClasses} ${opacity}
                                                `}
                                                style={{ left: leftPct }}
                                            >
                                                <span className={`${numPlayers === 1 ? 'text-4xl md:text-6xl' : 'text-3xl md:text-5xl'} font-black text-gray-800 tracking-tight text-center leading-none`}>
                                                    {opt.word}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </>
                    )}

                    {/* Firework Explosions (Inside Transformed World) */}
                    {explosions.map(exp => (
                        <FireworkBurst key={exp.id} x={exp.x} y={exp.y} />
                    ))}

                    {/* Avatars (Inside Transformed World) */}
                    {sortedLandmarks.map((poses, idx) => {
                        if (idx >= numPlayers) return null;
                        const nose = poses[0];
                        if (!nose || nose.visibility <= 0.5) return null;
                        const isP1 = idx === 0;
                        const yPos = nose.y * 100 - 10;
                        const xPos = (1 - nose.x) * 100;
                        const labelColor = isP1 ? "bg-red-500" : "bg-green-500";
                        const mushroomFilter = isP1 ? "" : "hue-rotate(90deg)";
                        return (
                            <div
                                key={idx}
                                className={`game-cursor absolute flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2 z-50 transition-none`}
                                style={{ left: `${xPos}%`, top: `${yPos}%` }}
                            >
                                <div className="relative">
                                    <span
                                        className="text-[6rem] block filter drop-shadow-lg"
                                        style={{ filter: `${mushroomFilter} drop-shadow(0 4px 6px rgba(0,0,0,0.5))` }}
                                    >
                                        🍄
                                    </span>
                                </div>
                                <span className={`${labelColor} text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-md -mt-4 z-10`}>
                                    P{idx + 1}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* MARIO-INSPIRED BACKDROP (With Parallax Offset) */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[#6b8cff]/60">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#6b8cff]/60 to-transparent mix-blend-multiply"></div>

                    {/* Parallax Clouds (Smarter translation: camera.x * smallFactor) */}
                    <div
                        className="absolute inset-0 w-[120%] h-full flex"
                        style={{ transform: `translateX(${camera.x * 0.2}%)` }}
                    >
                        <div className="absolute top-20 left-[10%] opacity-40 text-white text-9xl animate-pulse">☁️</div>
                        <div className="absolute top-40 left-[65%] opacity-30 text-white text-8xl animate-pulse delay-700">☁️</div>
                        <div className="absolute top-10 left-[40%] opacity-20 text-white text-7xl">☁️</div>
                    </div>

                    {/* Parallax Hills (Faster than clouds, slower than world) */}
                    <div
                        className="absolute bottom-0 w-[150%] h-32 flex items-end opacity-70"
                        style={{ transform: `translateX(${camera.x * 0.5}%)` }}
                    >
                        <div className="w-1/3 h-20 bg-green-500 rounded-t-[4rem] mx-[-40px] border-4 border-green-700/40"></div>
                        <div className="w-1/2 h-32 bg-green-400 rounded-t-[6rem] z-10 mx-[-20px] border-4 border-green-600/40"></div>
                        <div className="w-1/4 h-16 bg-green-600 rounded-t-[3rem] mx-[-10px] border-4 border-green-800/40"></div>
                        <div className="w-1/3 h-24 bg-green-500 rounded-t-[5rem] flex-grow border-4 border-green-700/40"></div>
                    </div>
                </div>

                {/* Split Screen Divider */}
                {numPlayers === 2 && (
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 z-10 w-2 bg-yellow-300 shadow-[0_0_25px_rgba(253,224,71,0.9)] h-full"></div>
                )}

            </div>
        </div>
    );
};

export default GameLevel;
