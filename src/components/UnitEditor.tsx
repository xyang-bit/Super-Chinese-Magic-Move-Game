import React, { useState, useRef } from 'react';
import { GameUnit, WordItem } from '../types';
import { speak } from '../services/soundService';

interface UnitEditorProps {
    unit?: GameUnit;
    onSave: (unit: GameUnit) => void;
    onCancel: () => void;
    onDelete?: (id: string) => void;
}

const COLORS = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500',
    'bg-green-500', 'bg-teal-500', 'bg-blue-500',
    'bg-indigo-500', 'bg-purple-600', 'bg-pink-500',
    'bg-slate-500', 'bg-cyan-600', 'bg-rose-500'
];

const COMMON_EMOJIS = [
    '📝', '📚', '✏️', '🏫', '🍎', '🍌', '🍔', '🍕',
    '⚽', '🏀', '🎮', '🎨', '🐶', '🐱', '🐼', '🦁',
    '🚗', '✈️', '🏠', '🏥', '🇨🇳', '🇺🇸', '🌏', '😀',
    '😎', '🤔', '❤️', '⭐', '🔥', '💧', '🎵', '💻'
];

const UnitEditor: React.FC<UnitEditorProps> = ({ unit, onSave, onCancel, onDelete }) => {
    const [title, setTitle] = useState(unit?.title || '');
    const [icon, setIcon] = useState(unit?.icon || '📝');
    const [color, setColor] = useState(unit?.color || COLORS[Math.floor(Math.random() * COLORS.length)]);
    const [words, setWords] = useState<WordItem[]>(unit?.words || []);

    // New word state
    const [newZh, setNewZh] = useState('');
    const [newEn, setNewEn] = useState('');

    // Bulk add state
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkText, setBulkText] = useState('');

    // Audio Recording State
    const [recordingId, setRecordingId] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const handleAddWord = () => {
        if (!newZh.trim() || !newEn.trim()) return;
        const newWord: WordItem = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            word: newZh.trim(),
            english: newEn.trim(),
            emoji: ''
        };
        setWords([...words, newWord]);
        setNewZh('');
        setNewEn('');
    };

    const handleBulkProcess = () => {
        const lines = bulkText.split('\n');
        const newItems: WordItem[] = [];

        lines.forEach(line => {
            if (!line.trim()) return;
            let parts = line.split('|');
            if (parts.length < 2) parts = line.split('\t');
            if (parts.length < 2) parts = line.split(/[,，]/);

            if (parts.length >= 2) {
                const zh = parts[0].trim();
                const en = parts[1].trim();
                if (zh && en) {
                    newItems.push({
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5) + newItems.length,
                        word: zh,
                        english: en,
                        emoji: ''
                    });
                }
            }
        });

        if (newItems.length > 0) {
            setWords([...words, ...newItems]);
            setBulkText('');
            setIsBulkMode(false);
        } else {
            alert("Could not parse words. Please use format: Chinese | English");
        }
    };

    const handleDeleteWord = (id: string) => {
        setWords(words.filter(w => w.id !== id));
    };

    const handleSave = () => {
        if (!title.trim()) {
            alert("Please enter a unit title");
            return;
        }
        if (words.length < 1) {
            alert("Please add at least one word");
            return;
        }

        const newUnit: GameUnit = {
            id: unit?.id || 'u_' + Date.now().toString(),
            title,
            icon,
            color,
            words
        };
        onSave(newUnit);
    };

    // --- Audio Handling ---

    const handleStartRecording = async (wordId: string) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    const base64data = reader.result as string;
                    updateWordSound(wordId, base64data);
                };
                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setRecordingId(wordId);
        } catch (err) {
            console.error("Microphone error:", err);
            alert("Could not access microphone. Please ensure you have granted permission.");
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setRecordingId(null);
        }
    };

    const handleFileUpload = (wordId: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                updateWordSound(wordId, result);
            };
            reader.readAsDataURL(file);
        }
    };

    const updateWordSound = (wordId: string, soundData: string | undefined) => {
        setWords(prev => prev.map(w => {
            if (w.id === wordId) {
                return { ...w, soundAudio: soundData };
            }
            return w;
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-2xl font-bold text-gray-800">{unit ? 'Edit Unit' : 'Create New Unit'}</h2>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content Scrollable */}
                <div className="p-6 overflow-y-auto flex-1 space-y-8">
                    {/* Unit Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1">Unit Title</label>
                                <input
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-bold text-lg"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g. Lesson 5: Fruits"
                                />
                            </div>

                            {/* Emoji Selection */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-2">Icon (Select or Type)</label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        className="w-16 text-center border-2 border-gray-200 rounded-xl px-2 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-2xl"
                                        value={icon}
                                        onChange={e => setIcon(e.target.value)}
                                        placeholder="?"
                                        maxLength={2}
                                    />
                                    <div className="flex-1 overflow-x-auto pb-2">
                                        <div className="flex gap-2">
                                            {COMMON_EMOJIS.map(e => (
                                                <button
                                                    key={e}
                                                    onClick={() => setIcon(e)}
                                                    className={`text-2xl w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 flex-shrink-0 transition-all ${icon === e ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
                                                >
                                                    {e}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Color Picker */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-2">Card Color Theme</label>
                            <div className="grid grid-cols-6 gap-3 mb-4">
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={`w-8 h-8 rounded-full ${c} ${color === c ? 'ring-4 ring-offset-2 ring-gray-300 scale-110 shadow-md' : 'hover:scale-110 hover:shadow'} transition-all`}
                                    />
                                ))}
                            </div>
                            <div className={`w-full h-24 rounded-2xl ${color} flex items-center justify-center text-white shadow-lg transform transition-all`}>
                                <div className="text-center">
                                    <span className="text-4xl block mb-1 drop-shadow-sm">{icon}</span>
                                    <span className="font-bold text-lg drop-shadow-sm px-4 truncate max-w-[200px] block">{title || 'Unit Title'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Add Words Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                <span>📚</span> Word List
                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-normal">{words.length} words</span>
                            </h3>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setIsBulkMode(false)}
                                    className={`px-3 py-1 text-sm font-semibold rounded-md transition-all ${!isBulkMode ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Single Add
                                </button>
                                <button
                                    onClick={() => setIsBulkMode(true)}
                                    className={`px-3 py-1 text-sm font-semibold rounded-md transition-all ${isBulkMode ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Bulk Import
                                </button>
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 shadow-inner">
                            {isBulkMode ? (
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                                        Paste words (Format: Chinese | English)
                                    </label>
                                    <textarea
                                        className="w-full h-32 border border-blue-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-300 outline-none font-mono"
                                        placeholder={`你好 | Hello\n谢谢 | Thank You\n再见 | Goodbye`}
                                        value={bulkText}
                                        onChange={e => setBulkText(e.target.value)}
                                    />
                                    <div className="flex justify-end">
                                        <button
                                            onClick={handleBulkProcess}
                                            className="bg-blue-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
                                        >
                                            Process & Add
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col md:flex-row gap-3 items-end">
                                    <div className="flex-1 w-full">
                                        <label className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-1 block pl-1">Chinese</label>
                                        <input
                                            className="w-full border border-blue-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-300"
                                            placeholder="e.g. 苹果"
                                            value={newZh}
                                            onChange={e => setNewZh(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && document.getElementById('en-input')?.focus()}
                                        />
                                    </div>
                                    <div className="flex-1 w-full">
                                        <label className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-1 block pl-1">English</label>
                                        <input
                                            id="en-input"
                                            className="w-full border border-blue-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-300"
                                            placeholder="e.g. Apple"
                                            value={newEn}
                                            onChange={e => setNewEn(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddWord()}
                                        />
                                    </div>
                                    <button
                                        onClick={handleAddWord}
                                        className="w-full md:w-auto bg-blue-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-sm h-[42px]"
                                    >
                                        Add
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Word List Display */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                                {words.length === 0 && (
                                    <div className="text-center py-10 bg-gray-50">
                                        <p className="text-gray-400 italic">No words added yet.</p>
                                        <p className="text-xs text-gray-300 mt-1">Add words above to get started!</p>
                                    </div>
                                )}
                                {words.map((w, idx) => (
                                    <div key={w.id} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors group">
                                        <div className="flex items-center gap-4 flex-1">
                                            <span className="text-gray-300 font-mono text-xs w-6 text-right group-hover:text-blue-400">{idx + 1}</span>
                                            <div className="min-w-[120px]">
                                                <p className="font-bold text-gray-800 text-lg">{w.word}</p>
                                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{w.english}</p>
                                            </div>

                                            {/* Audio Controls */}
                                            <div className="flex items-center gap-2 ml-4">
                                                {/* RECORD BUTTON */}
                                                {recordingId === w.id ? (
                                                    <button
                                                        onClick={handleStopRecording}
                                                        className="flex items-center gap-2 bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold animate-pulse hover:bg-red-200"
                                                    >
                                                        <span className="w-2 h-2 rounded-full bg-red-600"></span>
                                                        STOP
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleStartRecording(w.id)}
                                                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all"
                                                        title="Record Audio"
                                                    >
                                                        🎤
                                                    </button>
                                                )}

                                                {/* UPLOAD BUTTON */}
                                                <label className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 p-2 rounded-full transition-all cursor-pointer">
                                                    <input
                                                        type="file"
                                                        accept="audio/*"
                                                        className="hidden"
                                                        onChange={(e) => handleFileUpload(w.id, e)}
                                                    />
                                                    📂
                                                </label>

                                                {/* PLAY PREVIEW */}
                                                {w.soundAudio && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                const a = new Audio(w.soundAudio);
                                                                a.play();
                                                            }}
                                                            className="text-green-500 hover:bg-green-50 p-2 rounded-full transition-all"
                                                            title="Play Custom Audio"
                                                        >
                                                            ▶️
                                                        </button>
                                                        <button
                                                            onClick={() => updateWordSound(w.id, undefined)}
                                                            className="text-gray-300 hover:text-red-400 text-xs"
                                                            title="Remove Audio"
                                                        >
                                                            ✕
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Delete Word */}
                                        <button
                                            onClick={() => handleDeleteWord(w.id)}
                                            className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                            title="Delete Word"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center gap-4 z-10">
                    {unit && onDelete ? (
                        <button
                            onClick={() => { if (confirm('Are you sure you want to delete this unit? This cannot be undone.')) onDelete(unit.id); }}
                            className="text-red-500 hover:text-red-700 font-semibold px-4 py-2 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 text-sm md:text-base"
                        >
                            <span>🗑️</span> <span className="hidden sm:inline">Delete Unit</span>
                        </button>
                    ) : (
                        <div className="flex-1"></div>
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="px-6 py-2 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-8 py-2 rounded-xl font-bold text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-green-500/30 transform hover:-translate-y-0.5 transition-all"
                        >
                            Save Unit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UnitEditor;
