
'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LayoutGrid, Play, RefreshCw, Eye, Trophy, ArrowRight, RotateCcw } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { PlaceHolderImages, type ImagePlaceholder } from '@/lib/placeholder-images';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { games } from '@/lib/games';

type Piece = {
  id: number;
  correctIndex: number;
  currentIndex: number;
};

const jigsawImages = PlaceHolderImages.filter(img =>
  ['jigsaw-puzzle', 'jigsaw-puzzle-2', 'jigsaw-puzzle-3', 'jigsaw-puzzle-4'].includes(img.id)
);

const SWAP_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/card-sounds-35956.mp3?alt=media&token=c135cab6-55a4-4297-bd14-3d57c66f7b0f';
const SELECT_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/select-menu-47560.mp3?alt=media&token=7eacb2d1-6bf3-4998-8435-ab614b0754ff';
const COMPLETE_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/crowd-cheering-383111.mp3?alt=media&token=ebc76a39-6400-4b39-ac6a-f7d437f07744';

const STORAGE_KEY_HIGH_LEVEL = 'jigsawPuzzle_highLevel';
const STORAGE_KEY_LAST_PLAYS = 'jigsawPuzzle_lastPlays';

export default function JigsawPuzzlePage() {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'solved' | 'finished'>('idle');
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [level, setLevel] = useState(1);
  const [highLevel, setHighLevel] = useState(1);
  const [lastPlays, setLastPlays] = useState<{ moves: number; time: number; level: number }[]>([]);
  
  const gameInfo = games.find(g => g.href.includes('jigsaw-puzzle'));
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const timerRef = useRef<NodeJS.Timeout>();
  
  const gridSize = Math.floor((level - 1) / 4) + 2;
  const pieceCount = gridSize * gridSize;
  const currentImage = jigsawImages[(level - 1) % jigsawImages.length];

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const storedHighLevel = localStorage.getItem(STORAGE_KEY_HIGH_LEVEL);
        const storedLastPlays = localStorage.getItem(STORAGE_KEY_LAST_PLAYS);
        if (storedHighLevel) {
            const high = parseInt(storedHighLevel, 10);
            setHighLevel(high);
            setLevel(high);
        }
        if (storedLastPlays) {
            setLastPlays(JSON.parse(storedLastPlays));
        }

        audioRefs.current = {
            select: new Audio(SELECT_SOUND_URL),
            swap: new Audio(SWAP_SOUND_URL),
            complete: new Audio(COMPLETE_SOUND_URL),
        };
        Object.values(audioRefs.current).forEach(audio => {
            audio.load();
        });
    }
  }, []);

  const playSound = (soundName: keyof typeof audioRefs.current) => {
    const audio = audioRefs.current[soundName];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(error => console.error(`Error playing ${soundName} sound:`, error));
    }
  };

  const handleEndGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    playSound('complete');
    setGameState('solved');

    setTimeout(() => {
      setGameState('finished');
    }, 2000);

    if (level >= highLevel) {
      const newHighLevel = level + 1;
      setHighLevel(newHighLevel);
      localStorage.setItem(STORAGE_KEY_HIGH_LEVEL, newHighLevel.toString());
    }
    const newLastPlays = [{ moves, time, level }, ...lastPlays].slice(0, 5);
    setLastPlays(newLastPlays);
    localStorage.setItem(STORAGE_KEY_LAST_PLAYS, JSON.stringify(newLastPlays));
  }, [moves, time, level, highLevel, lastPlays, playSound]);

  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTime(prevTime => prevTime + 1);
      }, 1000);
    }
    return () => {
        if(timerRef.current) clearInterval(timerRef.current)
    };
  }, [gameState]);

  const startGame = (startLevel: number) => {
    const currentGridSize = Math.floor((startLevel - 1) / 4) + 2;
    const currentPieceCount = currentGridSize * currentGridSize;

    const createPieces = () => {
        return Array.from({ length: currentPieceCount }, (_, i) => ({
          id: i,
          correctIndex: i,
          currentIndex: i,
        }));
    };
    
    const newPieces = createPieces();
    
    let shuffledIndices;
    let isSolved = true;
    while (isSolved) {
        shuffledIndices = [...Array(currentPieceCount).keys()].sort(() => Math.random() - 0.5);
        isSolved = shuffledIndices.every((val, idx) => val === idx);
    }
    
    newPieces.forEach((piece, index) => {
      piece.currentIndex = shuffledIndices[index];
    });

    setPieces(newPieces);
    setMoves(0);
    setTime(0);
    setGameState('playing');
    setLevel(startLevel);
  };

  const checkCompletion = useCallback((currentPieces: Piece[]) => {
    if (currentPieces.length === 0) return;
    const isSolved = currentPieces.every(p => p.correctIndex === p.currentIndex);
    if (isSolved) {
      handleEndGame();
    }
  }, [handleEndGame]);

  const handlePieceClick = (clickedPiece: Piece) => {
    if (gameState !== 'playing') return;

    if (!selectedPiece) {
      playSound('select');
      setSelectedPiece(clickedPiece);
    } else if (selectedPiece.id === clickedPiece.id) {
      setSelectedPiece(null);
    } else {
      playSound('swap');
      setMoves(m => m + 1);
      const newPieces = [...pieces];
      const selectedGamePiece = newPieces.find(p => p.id === selectedPiece.id);
      const clickedGamePiece = newPieces.find(p => p.id === clickedPiece.id);

      if (selectedGamePiece && clickedGamePiece) {
        const selectedsCurrentIndex = selectedGamePiece.currentIndex;
        selectedGamePiece.currentIndex = clickedGamePiece.currentIndex;
        clickedGamePiece.currentIndex = selectedsCurrentIndex;
        
        setPieces(newPieces);
        checkCompletion(newPieces);
      }
      setSelectedPiece(null);
    }
  };

  const handleRestart = () => {
    setGameState('idle');
    setPieces([]);
    setSelectedPiece(null);
    setLevel(highLevel);
  }
  
  const handleResetLevel = () => {
    setHighLevel(1);
    setLevel(1);
    setLastPlays([]);
    localStorage.removeItem(STORAGE_KEY_HIGH_LEVEL);
    localStorage.removeItem(STORAGE_KEY_LAST_PLAYS);
  }

  const handleNextLevel = () => {
    const nextLevel = level + 1;
    startGame(nextLevel);
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="flex flex-col items-center justify-center gap-4 p-4 md:p-8 min-h-[600px]">
        {gameState === 'idle' && (
           <div className="flex flex-col items-center gap-4 text-center">
              {gameInfo?.imageUrl && (
                  <Image
                      src={gameInfo.imageUrl as string}
                      alt={gameInfo.title}
                      width={150}
                      height={150}
                      className="rounded-full border-4 border-white shadow-lg"
                  />
              )}
              <h2 className="text-3xl font-bold font-headline mt-4">{gameInfo?.title}</h2>
              <div className="flex items-center gap-4 text-xl font-semibold bg-muted p-2 px-4 rounded-full">
                  <Trophy className="w-6 h-6 text-yellow-400" />
                  <span>Highest Level: {highLevel}</span>
              </div>

              {lastPlays.length > 0 && (
                  <div className="mt-4 w-full max-w-xs">
                      <h3 className="font-semibold text-lg">Last Plays</h3>
                      <ul className="mt-2 space-y-1 text-base">
                          {lastPlays.map((play, index) => (
                              <li key={index} className="flex justify-between items-center bg-muted/50 p-2 rounded-md">
                                  <span>Level {play.level}</span>
                                  <span className="font-bold">{play.moves} moves / {formatTime(play.time)}</span>
                              </li>
                          ))}
                      </ul>
                  </div>
              )}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
                    <Button size="lg" onClick={() => startGame(highLevel)}>
                        <Play className="mr-2 h-5 w-5" />
                        Start Game
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button size="lg" variant="outline">
                                 <RotateCcw className="mr-2 h-5 w-5" />
                                 Reset Level
                             </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will reset your highest level back to 1. You cannot undo this action.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleResetLevel}>Confirm</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
          </div>
        )}
        
        {(gameState === 'playing' || gameState === 'solved') && currentImage && (
          <>
            <div className="w-full flex justify-between font-semibold text-lg mb-2">
                <span>Level: {level}</span>
                <span>Moves: {moves}</span>
                <span>Time: {formatTime(time)}</span>
            </div>
            <div 
              className="relative grid w-full max-w-sm md:max-w-md aspect-square border-2 border-primary rounded-lg overflow-hidden shadow-lg"
              style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
            >
              {Array.from({ length: pieceCount }).map((_, i) => {
                const piece = pieces.find(p => p.currentIndex === i);
                if (!piece) return null;
                const isSelected = selectedPiece?.id === piece.id;

                return (
                  <div
                    key={i}
                    className={cn(
                        "relative w-full h-full border border-primary/20",
                        {"cursor-pointer": gameState === 'playing'},
                        { "border-green-500 border-4 z-10 scale-105": isSelected },
                        {"transition-opacity duration-500": gameState === 'solved'}
                    )}
                    onClick={() => handlePieceClick(piece)}
                  >
                    <div
                      style={{
                        backgroundImage: `url(${currentImage.imageUrl})`,
                        backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
                        backgroundPosition: `${(piece.correctIndex % gridSize) * 100 / (gridSize - 1)}% ${(Math.floor(piece.correctIndex / gridSize)) * 100 / (gridSize - 1)}%`,
                      }}
                      className="w-full h-full"
                    />
                  </div>
                );
              })}
            </div>

            {gameState === 'playing' && (
                <div className="flex items-center gap-4 mt-4">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline">
                          <Eye className="mr-2 h-4 w-4" />
                          Show Hint
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <Image
                          src={currentImage.imageUrl}
                          alt="Puzzle Hint"
                          width={200}
                          height={200}
                          className="rounded-md"
                        />
                      </PopoverContent>
                    </Popover>
                     <Button variant="destructive" onClick={handleRestart}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Quit Game
                    </Button>
                </div>
            )}
            {gameState === 'solved' && (
              <div className="text-center mt-4">
                <h3 className="text-xl md:text-2xl font-headline text-accent animate-pulse">Complete!</h3>
              </div>
            )}
          </>
        )}
        {gameState === 'finished' && (
          <div className="text-center flex flex-col items-center gap-4 p-4 bg-card rounded-lg shadow-sm w-full">
            <h3 className="text-xl md:text-2xl font-headline text-accent">Level Complete!</h3>
            <div className='text-lg text-muted-foreground'>
                <p>Moves: <span className='font-bold'>{moves}</span></p>
                <p>Time: <span className='font-bold'>{formatTime(time)}</span></p>
            </div>
             <Button size="lg" onClick={handleNextLevel}>
                <ArrowRight className="mr-2 h-5 w-5" />
                Next Level
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
