import React, { useState } from 'react';
import Menu from './components/Menu';
import MotionStart from './components/MotionStart';
import GameLevel from './components/GameLevel';
import { GameUnit } from './types';
import { UNITS } from './constants';

const App: React.FC = () => {
    const [screen, setScreen] = useState<'menu' | 'motion-start' | 'game'>('menu');
    const [units, setUnits] = useState<GameUnit[]>(UNITS);
    const [currentUnit, setCurrentUnit] = useState<GameUnit | null>(null);
    const [numPlayers, setNumPlayers] = useState<number>(1);
    const [gameMode, setGameMode] = useState<'classic' | 'translation'>('classic');

    const handleSelectUnit = (unit: GameUnit) => {
        setCurrentUnit(unit);
        // Go to Motion Start first instead of directly to game
        setScreen('motion-start');
    };

    const handleUpdateUnit = (updatedUnit: GameUnit) => {
        setUnits(prev => {
            const index = prev.findIndex(u => u.id === updatedUnit.id);
            if (index >= 0) {
                const newUnits = [...prev];
                newUnits[index] = updatedUnit;
                return newUnits;
            } else {
                return [...prev, updatedUnit];
            }
        });
    };

    const handleDeleteUnit = (id: string) => {
        setUnits(prev => prev.filter(u => u.id !== id));
    };

    const handleMotionStartComplete = () => {
        setScreen('game');
    };

    const handleExitGame = () => {
        setScreen('menu');
        setCurrentUnit(null);
    };

    return (
        <>
            {screen === 'menu' && (
                <Menu
                    units={units}
                    onSelectUnit={handleSelectUnit}
                    onUpdateUnit={handleUpdateUnit}
                    onDeleteUnit={handleDeleteUnit}
                    numPlayers={numPlayers}
                    setNumPlayers={setNumPlayers}
                    gameMode={gameMode}
                    setGameMode={setGameMode}
                />
            )}
            {screen === 'motion-start' && (
                <MotionStart
                    onStart={handleMotionStartComplete}
                    numPlayers={numPlayers}
                />
            )}
            {screen === 'game' && currentUnit && (
                <GameLevel
                    unit={currentUnit}
                    onExit={handleExitGame}
                    numPlayers={numPlayers}
                    gameMode={gameMode}
                />
            )}
        </>
    );
};

export default App;
