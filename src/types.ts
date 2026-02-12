export interface WordItem {
    id: string;
    word: string;
    english: string;
    emoji: string;
    image?: string;
    soundAudio?: string; // Base64 Data URL
}

export interface GameUnit {
    id: string;
    title: string;
    color: string;
    icon: string;
    words: WordItem[];
}

export type GameState = 'menu' | 'playing' | 'feedback_correct' | 'feedback_wrong' | 'loading';

export interface BoxPosition {
    id: string;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    width: number;
    height: number;
    item: WordItem;
}

export interface Landmark {
    x: number;
    y: number;
    z: number;
    visibility: number;
}
