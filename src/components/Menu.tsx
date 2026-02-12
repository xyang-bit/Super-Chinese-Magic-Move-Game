import React, { useState } from 'react';
import { GameUnit } from '../types';
import UnitEditor from './UnitEditor';

interface MenuProps {
    units: GameUnit[];
    onSelectUnit: (unit: GameUnit) => void;
    onUpdateUnit: (unit: GameUnit) => void;
    onDeleteUnit: (id: string) => void;
    numPlayers: number;
    setNumPlayers: (num: number) => void;
    gameMode: 'classic' | 'translation';
    setGameMode: (mode: 'classic' | 'translation') => void;
}

const Menu: React.FC<MenuProps> = ({
    units,
    onSelectUnit,
    onUpdateUnit,
    onDeleteUnit,
    numPlayers,
    setNumPlayers,
    gameMode,
    setGameMode
}) => {
    const [isManageMode, setIsManageMode] = useState(false);
    const [editingUnit, setEditingUnit] = useState<GameUnit | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const handleEditClick = (unit: GameUnit, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingUnit(unit);
    };

    const handleSave = (unit: GameUnit) => {
        onUpdateUnit(unit);
        setEditingUnit(null);
        setIsCreating(false);
    };

    const handleDelete = (id: string) => {
        onDeleteUnit(id);
        setEditingUnit(null);
    };

    return (
        <div className="min-h-screen bg-yellow-50 p-6 flex flex-col items-center relative">

            {/* Edit Mode Toggle (Top Right) */}
            <div className="absolute top-4 right-4 z-20">
                <button
                    onClick={() => setIsManageMode(!isManageMode)}
                    className={`
                flex items-center gap-2 px-4 py-2 rounded-full font-bold shadow-md transition-all
                ${isManageMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}
            `}
                >
                    <span>{isManageMode ? 'Done' : '⚙️ Manage Units'}</span>
                </button>
            </div>

            <header className="mb-8 text-center animate-pop w-full max-w-4xl mt-8">
                <h1 className="text-5xl md:text-7xl font-bold text-red-600 mb-2 drop-shadow-md">
                    Super Chinese
                </h1>
                <p className="text-xl md:text-2xl text-gray-600 font-semibold mb-6">
                    Magic Move Game 🏃♀️🇨🇳
                </p>

                {/* Game Config Controls - Hide in Manage Mode to reduce clutter */}
                {!isManageMode && (
                    <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-6 animate-slide-up">
                        {/* Player Selection Toggle */}
                        <div className="inline-flex bg-white rounded-full p-1 shadow-md border-2 border-blue-100">
                            <button
                                onClick={() => setNumPlayers(1)}
                                className={`px-6 py-2 rounded-full font-bold text-lg transition-all ${numPlayers === 1
                                        ? 'bg-red-500 text-white shadow-sm'
                                        : 'text-gray-500 hover:bg-gray-100'
                                    }`}
                            >
                                👤 1 Player
                            </button>
                            <button
                                onClick={() => setNumPlayers(2)}
                                className={`px-6 py-2 rounded-full font-bold text-lg transition-all ${numPlayers === 2
                                        ? 'bg-purple-500 text-white shadow-sm'
                                        : 'text-gray-500 hover:bg-gray-100'
                                    }`}
                            >
                                👥 2 Players
                            </button>
                        </div>

                        {/* Game Mode Toggle */}
                        <div className="inline-flex bg-white rounded-full p-1 shadow-md border-2 border-blue-100">
                            <button
                                onClick={() => setGameMode('classic')}
                                className={`px-6 py-2 rounded-full font-bold text-lg transition-all ${gameMode === 'classic'
                                        ? 'bg-orange-500 text-white shadow-sm'
                                        : 'text-gray-500 hover:bg-gray-100'
                                    }`}
                            >
                                🔊 Listen (ZH)
                            </button>
                            <button
                                onClick={() => setGameMode('translation')}
                                className={`px-6 py-2 rounded-full font-bold text-lg transition-all ${gameMode === 'translation'
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'text-gray-500 hover:bg-gray-100'
                                    }`}
                            >
                                🔤 EN ➡️ ZH
                            </button>
                        </div>
                    </div>
                )}

                {isManageMode && (
                    <div className="bg-yellow-100 text-yellow-800 px-6 py-2 rounded-full font-bold inline-block mb-6 animate-bounce">
                        ✏️ Teacher Mode Active: Click cards to edit
                    </div>
                )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl pb-12">

                {/* Render Units */}
                {units.map((unit) => (
                    <div key={unit.id} className="relative group">
                        <button
                            onClick={() => isManageMode ? setEditingUnit(unit) : onSelectUnit(unit)}
                            className={`
                w-full h-full
                ${unit.color} 
                text-white p-8 rounded-3xl shadow-xl 
                transform transition-all duration-200 
                ${isManageMode ? 'hover:scale-105 hover:ring-4 ring-yellow-400 cursor-pointer' : 'hover:scale-105 hover:shadow-2xl active:scale-95'}
                flex flex-col items-center justify-center gap-4
                border-b-8 border-black/10
                relative overflow-hidden
                `}
                        >
                            {/* Manage Overlay Effect */}
                            {isManageMode && (
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                            )}

                            {isManageMode && (
                                <div className="absolute top-4 right-4 bg-white/30 p-2 rounded-full backdrop-blur-sm">
                                    ✏️
                                </div>
                            )}

                            <span className="text-6xl filter drop-shadow-sm">{unit.icon}</span>
                            <span className="text-4xl font-bold tracking-wide text-center">{unit.title}</span>
                            <span className="bg-white/20 px-4 py-1 rounded-full text-sm font-medium">
                                {unit.words.length} Words
                            </span>
                        </button>

                        {/* Delete Button (Manage Mode Only) */}
                        {isManageMode && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Are you sure you want to delete "${unit.title}"?`)) {
                                        handleDelete(unit.id);
                                    }
                                }}
                                className="absolute top-4 left-4 z-30 bg-white/90 hover:bg-red-500 hover:text-white text-red-500 p-2 rounded-full shadow-lg transition-all transform hover:scale-110 active:scale-90"
                                title="Delete Unit"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        )}
                    </div>
                ))}

                {/* Add New Unit Button (Only in Manage Mode) */}
                {isManageMode && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="
                    bg-white border-4 border-dashed border-gray-300 text-gray-400 
                    p-8 rounded-3xl shadow-sm hover:shadow-md hover:border-gray-400 hover:text-gray-600
                    transform transition-all duration-200 hover:scale-105
                    flex flex-col items-center justify-center gap-4
                    min-h-[250px]
                "
                    >
                        <span className="text-6xl text-gray-300">➕</span>
                        <span className="text-2xl font-bold">Add New Unit</span>
                    </button>
                )}
            </div>

            <footer className="mt-auto py-6 text-gray-500 text-sm font-medium">
                Make sure your camera is enabled! 📸
            </footer>

            {/* Editor Modal */}
            {(editingUnit || isCreating) && (
                <UnitEditor
                    unit={editingUnit || undefined}
                    onSave={handleSave}
                    onCancel={() => { setEditingUnit(null); setIsCreating(false); }}
                    onDelete={editingUnit ? handleDelete : undefined}
                />
            )}

        </div>
    );
};

export default Menu;
