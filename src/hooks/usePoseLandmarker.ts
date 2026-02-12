import React, { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Landmark } from '../types';

export const usePoseLandmarker = (videoRef: React.RefObject<HTMLVideoElement>) => {
    const [landmarker, setLandmarker] = useState<PoseLandmarker | null>(null);
    const [landmarks, setLandmarks] = useState<Landmark[][]>([]); // Changed to array of arrays
    const [isLoading, setIsLoading] = useState(true);
    const requestRef = useRef<number | null>(null);

    useEffect(() => {
        const createLandmarker = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );

                const newLandmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numPoses: 2, // Enable 2 players
                    minPoseDetectionConfidence: 0.5,
                    minPosePresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });

                setLandmarker(newLandmarker);
                setIsLoading(false);
            } catch (error) {
                console.error("Error loading PoseLandmarker:", error);
                setIsLoading(false);
            }
        };

        createLandmarker();

        return () => {
            // Cleanup if necessary
        };
    }, []);

    const detect = () => {
        if (landmarker && videoRef.current && videoRef.current.readyState >= 2) {
            const results = landmarker.detectForVideo(videoRef.current, performance.now());
            if (results.landmarks) {
                setLandmarks(results.landmarks as unknown as Landmark[][]);
            } else {
                setLandmarks([]);
            }
            requestRef.current = requestAnimationFrame(detect);
        } else {
            requestRef.current = requestAnimationFrame(detect);
        }
    };

    useEffect(() => {
        if (landmarker && !isLoading) {
            detect();
        }
        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [landmarker, isLoading]);

    return { landmarks, isLoading };
};
