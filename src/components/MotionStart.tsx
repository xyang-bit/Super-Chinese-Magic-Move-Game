import React, { useEffect, useRef, useMemo, useState } from 'react';
import { usePoseLandmarker } from '../hooks/usePoseLandmarker';
import { playSoundEffect } from '../services/soundService';

interface MotionStartProps {
    onStart: () => void;
    numPlayers: number;
}

const MotionStart: React.FC<MotionStartProps> = ({ onStart, numPlayers }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { landmarks, isLoading } = usePoseLandmarker(videoRef);
    const [triggerCount, setTriggerCount] = useState(0);

    // Sort landmarks to maintain consistency (P1 Left, P2 Right)
    const sortedLandmarks = useMemo(() => {
        if (landmarks.length === 0) return [];
        return [...landmarks].sort((a, b) => {
            const ax = 1 - (a[0]?.x || 0.5);
            const bx = 1 - (b[0]?.x || 0.5);
            return ax - bx;
        });
    }, [landmarks]);

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
                }
            }
        };
        setupCamera();
    }, []);

    // Collision Check for Start Button
    useEffect(() => {
        if (!sortedLandmarks || sortedLandmarks.length === 0) return;

        let hit = false;

        // Start Button Position (Center Top)
        // Centered horizontally (0.5), Top third (0.3)
        const buttonX = 0.5;
        const buttonY = 0.3;
        const buttonRadius = 0.15; // Hitbox radius

        // Check collision for any active player
        for (let i = 0; i < numPlayers; i++) {
            if (!sortedLandmarks[i]) continue;
            const nose = sortedLandmarks[i][0];

            if (nose && nose.visibility > 0.5) {
                const headX = 1 - nose.x;
                const headY = nose.y - 0.12; // Forehead offset

                const dx = headX - buttonX;
                const dy = headY - buttonY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < buttonRadius) {
                    hit = true;
                    break;
                }
            }
        }

        if (hit) {
            if (triggerCount > 20) { // ~0.5 seconds hold
                playSoundEffect('correct');
                onStart();
            } else {
                setTriggerCount(prev => prev + 1);
            }
        } else {
            setTriggerCount(0);
        }
    }, [sortedLandmarks, triggerCount, numPlayers, onStart]);

    return (
        <div className="fixed inset-0 bg-black overflow-hidden flex flex-col">
            {/* Title Bar */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-white/10 backdrop-blur-md z-30 border-b border-white/20">
                <h1 className="text-center text-white text-2xl md:text-3xl font-bold tracking-wider drop-shadow-lg font-mono">
                    GET READY!
                </h1>
            </div>

            {/* Video Background */}
            <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
                playsInline
                muted
            />

            {/* Start Button Zone */}
            <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                <div className={`
                relative group cursor-pointer
                transition-transform duration-100
                ${triggerCount > 0 ? 'scale-110' : 'scale-100'}
            `}>
                    <div className={`
                    bg-green-500 border-b-8 border-green-700 rounded-3xl px-12 py-8 shadow-2xl transition-all active:border-b-0 active:translate-y-2
                    ${triggerCount > 0 ? 'animate-pulse ring-8 ring-yellow-400/50' : ''}
                `}>
                        <span className="text-5xl md:text-7xl font-black text-white drop-shadow-md tracking-widest font-mono">
                            START
                        </span>
                    </div>
                    {/* Progress Indicator */}
                    {triggerCount > 0 && (
                        <div className="absolute -bottom-8 left-0 right-0 h-4 bg-gray-800 rounded-full overflow-hidden border-2 border-white/50">
                            <div
                                className="h-full bg-yellow-400 transition-all duration-75 ease-linear"
                                style={{ width: `${Math.min(100, (triggerCount / 20) * 100)}%` }}
                            />
                        </div>
                    )}
                </div>
                <p className="text-white font-bold text-xl mt-12 text-center bg-black/60 px-6 py-2 rounded-full backdrop-blur-sm shadow-xl animate-pulse">
                    Jump to hit the button!
                </p>
            </div>

            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 text-white">
                    <div className="text-3xl font-bold animate-pulse">Initializing Camera...</div>
                </div>
            )}

            {/* Avatars */}
            {sortedLandmarks.map((poses, idx) => {
                if (idx >= numPlayers) return null;
                const nose = poses[0];
                if (!nose || nose.visibility <= 0.5) return null;

                const isP1 = idx === 0;
                const yPos = nose.y * 100 - 12;
                const xPos = (1 - nose.x) * 100;
                const mushroomFilter = isP1 ? "" : "hue-rotate(90deg)";

                return (
                    <div
                        key={idx}
                        className="absolute flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none transition-none"
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
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-md -mt-4 z-10 ${isP1 ? "bg-red-500" : "bg-green-500"}`}>
                            P{idx + 1}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default MotionStart;
