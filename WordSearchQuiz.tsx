
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { WordSearchQuizNode, Language } from './types';
import { translations } from './translations';

// --- Types ---
interface WordSearchQuizProps {
    node: WordSearchQuizNode;
    onComplete: () => void;
    onSkip: () => void;
    language: Language;
}

type Grid = string[][];
type Coords = { row: number; col: number };

// --- Utility Functions ---
const generateGrid = (words: string[], size: number): { grid: Grid; placedWords: Map<string, Coords[]> } => {
    // This outer loop will retry the entire generation if a word fails to place.
    while (true) {
        let grid: (string | null)[][] = Array(size).fill(null).map(() => Array(size).fill(null));
        const placedWords = new Map<string, Coords[]>();
        let allWordsPlaced = true;

        const directions = [
            { r: 0, c: 1 },  // Horizontal
            { r: 1, c: 0 },  // Vertical
            { r: 1, c: 1 },  // Diagonal down-right
            { r: 0, c: -1 }, // Horizontal left
            { r: -1, c: 0 }, // Vertical up
            { r: -1, c: -1}, // Diagonal up-left
            { r: 1, c: -1},  // Diagonal down-left
            { r: -1, c: 1},  // Diagonal up-right
        ];

        for (const word of words) {
            let placed = false;
            // More attempts to be safe, but the outer while loop is the real guarantee.
            for (let attempts = 0; attempts < 200 && !placed; attempts++) {
                const dir = directions[Math.floor(Math.random() * directions.length)];
                const startRow = Math.floor(Math.random() * size);
                const startCol = Math.floor(Math.random() * size);

                let canPlace = true;
                const wordCoords: Coords[] = [];
                
                for (let i = 0; i < word.length; i++) {
                    const row = startRow + i * dir.r;
                    const col = startCol + i * dir.c;

                    if (row < 0 || row >= size || col < 0 || col >= size || (grid[row][col] && grid[row][col] !== word[i])) {
                        canPlace = false;
                        break;
                    }
                    wordCoords.push({ row, col });
                }

                if (canPlace) {
                    wordCoords.forEach((coord, i) => {
                        grid[coord.row][coord.col] = word[i];
                    });
                    placedWords.set(word, wordCoords);
                    placed = true;
                }
            }
            if (!placed) {
                allWordsPlaced = false;
                break; // This word failed, break to retry the whole grid generation
            }
        }
        
        if (allWordsPlaced) {
            const finalGrid = grid.map(row => row.map(cell => cell || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]));
            return { grid: finalGrid, placedWords };
        }
        // If not all words were placed, the `while(true)` loop continues, trying again.
    }
};

// --- Component ---
export const WordSearchQuiz: React.FC<WordSearchQuizProps> = ({ node, onComplete, onSkip, language }) => {
    const t = (key: string) => translations[language][key] || key;
    // Sort by longest word first to make placement easier and more reliable
    const wordsToFind = useMemo(() => node.words.map(t).sort((a, b) => b.length - a.length), [node.words, language]);

    const [gridData, setGridData] = useState<{ grid: Grid; placedWords: Map<string, Coords[]> } | null>(null);
    const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
    const [selection, setSelection] = useState<Coords[]>([]);
    const [isSelecting, setIsSelecting] = useState(false);
    
    const gridRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setGridData(generateGrid(wordsToFind, node.gridSize));
        setFoundWords(new Set());
        setSelection([]);
    }, [wordsToFind, node.gridSize]);

    const checkSelection = (currentSelection: Coords[]) => {
        if (currentSelection.length < 2 || !gridData) return;
        
        let selectedString = currentSelection.map(c => gridData.grid[c.row][c.col]).join('');
        let reversedSelectedString = selectedString.split('').reverse().join('');

        for (const word of wordsToFind) {
            if (!foundWords.has(word) && (word === selectedString || word === reversedSelectedString)) {
                const newFoundWords = new Set(foundWords).add(word);
                setFoundWords(newFoundWords);
                
                if (newFoundWords.size === wordsToFind.length) {
                    // Don't auto-complete, wait for user to click "Finish"
                }
                return; 
            }
        }
    };
    
    const getCoordsFromEvent = (e: React.MouseEvent | React.TouchEvent): Coords | null => {
        const target = e.target as HTMLElement;
        if (!target.matches('.ws-cell')) return null;
        const row = parseInt(target.dataset.row || '-1');
        const col = parseInt(target.dataset.col || '-1');
        if (row === -1 || col === -1) return null;
        return { row, col };
    };

    const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const coords = getCoordsFromEvent(e);
        if (coords) {
            setIsSelecting(true);
            setSelection([coords]);
        }
    };

    const handleInteractionMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isSelecting) return;
        e.preventDefault();
        
        const touchEvent = e.nativeEvent as TouchEvent;
        const clientX = 'touches' in touchEvent ? touchEvent.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in touchEvent ? touchEvent.touches[0].clientY : (e as React.MouseEvent).clientY;

        const element = document.elementFromPoint(clientX, clientY);
        if (element && element.matches('.ws-cell')) {
            const row = parseInt((element as HTMLElement).dataset.row || '-1');
            const col = parseInt((element as HTMLElement).dataset.col || '-1');
            const newCoord = { row, col };

            if (!selection.some(c => c.row === newCoord.row && c.col === newCoord.col)) {
                if (selection.length < 2) {
                    setSelection(prev => [...prev, newCoord]);
                } else {
                    const start = selection[0];
                    const second = selection[1];

                    // Determine the line's direction from the first two points
                    const dx = second.col - start.col;
                    const dy = second.row - start.row;

                    // The new point must be on the same line from the start point.
                    // We check this with a cross-product for collinearity.
                    const new_dx = newCoord.col - start.col;
                    const new_dy = newCoord.row - start.row;
                    
                    if (dy * new_dx === dx * new_dy) {
                         setSelection(prev => [...prev, newCoord]);
                    }
                }
            }
        }
    };

    const handleInteractionEnd = () => {
        setIsSelecting(false);
        checkSelection(selection);
        setSelection([]);
    };

    const isCellFound = (row: number, col: number) => {
        for (const word of foundWords) {
            const coords = gridData?.placedWords.get(word);
            if (coords?.some(c => c.row === row && c.col === col)) {
                return true;
            }
        }
        return false;
    };
    
    if (!gridData) return <div>{t('Loading...')}</div>;
    
    const allFound = foundWords.size === wordsToFind.length;

    return (
        <div className="mt-4 space-y-4 animate-fade-in-up">
            <div 
                ref={gridRef}
                className="ws-grid" 
                style={{ gridTemplateColumns: `repeat(${node.gridSize}, 1fr)` }}
                onMouseDown={handleInteractionStart}
                onMouseMove={handleInteractionMove}
                onMouseUp={handleInteractionEnd}
                onMouseLeave={handleInteractionEnd}
                onTouchStart={handleInteractionStart}
                onTouchMove={handleInteractionMove}
                onTouchEnd={handleInteractionEnd}
            >
                {gridData.grid.map((rowItems, rowIndex) =>
                    rowItems.map((cell, colIndex) => {
                        const isSelected = selection.some(c => c.row === rowIndex && c.col === colIndex);
                        const isFound = isCellFound(rowIndex, colIndex);
                        const cellClasses = `ws-cell ${isSelected ? 'selected' : ''} ${isFound ? 'found' : ''}`;
                        return (
                            <div key={`${rowIndex}-${colIndex}`} className={cellClasses} data-row={rowIndex} data-col={colIndex}>
                                {cell}
                            </div>
                        );
                    })
                )}
            </div>

            <div className="ws-word-list">
                {wordsToFind.map(word => (
                    <div key={word} className={`ws-word ${foundWords.has(word) ? 'found' : ''}`}>
                        {word}
                    </div>
                ))}
            </div>
            
            <div className="text-center pt-4">
                {!allFound ? (
                    <button
                        onClick={onSkip}
                        className="ws-skip-button"
                    >
                        {t('btn_skip_question')}
                    </button>
                ) : (
                    <button
                        onClick={onComplete}
                        className="ws-submit-button"
                    >
                        {t('btn_finish_quiz')}
                    </button>
                )}
            </div>
        </div>
    );
};
