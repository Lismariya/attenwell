
'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { LayoutGrid, Play, RefreshCw, Eye, Trophy, ArrowRight, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
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
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, increment, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { CoinIcon } from '@/components/catch-game-icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KID_LEVELS_CONFIG, getNextMission, isLevelUnlocked } from '@/lib/levels';
import { useProgression } from '@/hooks/useProgression';
import type { UserProfile } from '@/types/user';


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
const STORAGE_KEY_GAME_HISTORY = 'game_history';


export default function JigsawPuzzlePage() {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'solved' | 'finished'>('idle');
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [level, setLevel] = useState(1);
  const [nextGameSuggestion, setNextGameSuggestion] = useState<string | null>(null);
  const [playableLevel, setPlayableLevel] = useState<number | null>(null);
  
  const gameInfo = games.find(g => g.href.includes('jigsaw-puzzle'));
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const timerRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();
  const { checkAndAdvanceKidLevel } = useProgression();

  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null
  , [user, firestore]);
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const saveGameHistory = useCallback((status: string) => {
    if (typeof window !== 'undefined' && gameInfo) {
      const historyString = localStorage.getItem(STORAGE_KEY_GAME_HISTORY);
      const history = historyString ? JSON.parse(historyString) : [];
      const newEntry = {
        id: Date.now(),
        name: `${gameInfo.title} - Level ${level}`,
        status: status,
        timestamp: new Date().toISOString(),
      };
      const updatedHistory = [newEntry, ...history].slice(0, 5);
      localStorage.setItem(STORAGE_KEY_GAME_HISTORY, JSON.stringify(updatedHistory));
    }
  }, [gameInfo, level]);

  useEffect(() => {
    if (userProfile && gameInfo) {
      const nextMissionForThisGame = getNextMission(userProfile, gameInfo.title);

      if (nextMissionForThisGame && typeof nextMissionForThisGame === 'object' && nextMissionForThisGame.game === gameInfo.title) {
        // There's a playable level for this game
        setPlayableLevel(nextMissionForThisGame.level);
        setNextGameSuggestion(null);
      } else {
        // All levels for this game are complete for the current Kid Level.
        setPlayableLevel(null);
        
        // Now, find out what's next overall to give a suggestion.
        const nextOverallMission = getNextMission(userProfile, '');
        if (nextOverallMission === 'all complete') {
             setNextGameSuggestion('all complete');
        } else if (typeof nextOverallMission === 'string') {
            setNextGameSuggestion(nextOverallMission);
        } else if (nextOverallMission) { // It's a Mission object for another game
            setNextGameSuggestion(nextOverallMission.game);
        } else {
            setNextGameSuggestion(null); // Should not happen if logic is correct
        }
      }
    }
  }, [userProfile, gameInfo, gameState]);

  
  const gridSize = level <= 3 ? 2 : 3;
  const pieceCount = gridSize * gridSize;
  const currentImage = jigsawImages[(level - 1) % jigsawImages.length];

  useEffect(() => {
    if (typeof window !== 'undefined') {
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

  const updateProgress = useCallback(async () => {
    if (!userDocRef || !gameInfo || !firestore) return;

    const coinsEarned = Math.max(10, 100 - (moves + Math.floor(time / 10)));

    try {
      await runTransaction(firestore, async (transaction) => {
        const userDocSnapshot = await transaction.get(userDocRef);
        if (!userDocSnapshot.exists()) {
          throw new Error("User document does not exist!");
        }

        const freshUserProfile = userDocSnapshot.data() as UserProfile;
        const currentKidLevel = freshUserProfile.kid_level || 1;
        
        const missionsForCurrentLevel = KID_LEVELS_CONFIG[currentKidLevel];
        if (!missionsForCurrentLevel) {
            console.warn(`No missions found for Kid Level ${currentKidLevel}.`);
            return;
        }

        const isMissionInCurrentKidLevel = missionsForCurrentLevel.some(m => typeof m !== 'string' && m.game === gameInfo.title && m.level === level);

        if (!isMissionInCurrentKidLevel) {
            console.warn(`Mission ${gameInfo.title} L${level} not found in Kid Level ${currentKidLevel}. Progress not saved.`);
            return;
        }

        const kidLevelKey = `KidLevel${currentKidLevel}`;
        const missionKey = `${gameInfo.title.replace(/\s+/g, '')}-${level}`;
        const gameKey = gameInfo.href.substring(1) as keyof UserProfile['gameProgress'];
        
        const newLevelProgress = {
            ...(freshUserProfile.levelProgress || {}),
            [kidLevelKey]: {
                ...(freshUserProfile.levelProgress?.[kidLevelKey] || {}),
                [missionKey]: true,
            },
        };

        const newGameProgress = {
            ...(freshUserProfile.gameProgress || {}),
            [gameKey]: Math.max(freshUserProfile.gameProgress?.[gameKey] || 0, level),
        };
        
        const updatePayload = {
            levelProgress: newLevelProgress,
            gameProgress: newGameProgress,
            coin: increment(coinsEarned),
        };

        transaction.update(userDocRef, updatePayload);
      });

      toast({ title: "Progress Saved!", description: `Level ${level} of ${gameInfo.title} completed.` });
      await checkAndAdvanceKidLevel();

    } catch (error: any) {
      console.error("Progress update transaction failed: ", error);
      toast({ variant: 'destructive', title: 'Error', description: `Failed to save progress: ${error.message}` });
    }
  }, [userDocRef, firestore, gameInfo, level, moves, time, toast, checkAndAdvanceKidLevel]);

  const handleEndGame = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    playSound('complete');
    await updateProgress();
    saveGameHistory('Completed');
    setGameState('solved');

    setTimeout(() => {
      setGameState('finished');
    }, 2000);

    const nextMission = getNextMission(userProfile, gameInfo?.title || "");
    if (!nextMission) {
        setNextGameSuggestion("all complete");
    } else if (typeof nextMission === 'string') {
        setNextGameSuggestion(nextMission);
    }
  }, [playSound, updateProgress, userProfile, gameInfo, saveGameHistory]);

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
    setLevel(startLevel);
    
    const currentGridSize = startLevel <= 3 ? 2 : 3;
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
    saveGameHistory('Quit');
    setGameState('idle');
    setPieces([]);
    setSelectedPiece(null);
  }

  const handleNextLevel = () => {
    setGameState('idle');
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  const isLoading = isUserLoading || isProfileLoading;

  return (
    <Card className="w-full max-w-2xl mx-auto">
       <CardHeader className="text-center">
        <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit mb-2">
          <LayoutGrid className="h-6 w-6 md:h-8 md:w-8" />
        </div>
        <CardTitle className="text-2xl md:text-3xl font-headline">Jigsaw Puzzle</CardTitle>
        <CardDescription>
          {gameState === 'idle'
            ? 'Arrange the scrambled pieces to solve the puzzle.'
            : 'Click a piece to select it, then click another to swap.'}
        </CardDescription>
      </CardHeader>
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
              <p className="text-muted-foreground">Kid Level: {userProfile?.kid_level || 1}</p>
              {playableLevel !== null && <p className="text-lg font-semibold">Next up: Level {playableLevel}</p>}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
                    <Button size="lg" onClick={() => playableLevel && startGame(playableLevel)} disabled={isLoading || playableLevel === null}>
                       {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
                        Start Game
                    </Button>
                    {playableLevel === null && userProfile && (
                        <Alert className="mt-4 text-left">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Great Job!</AlertTitle>
                            <AlertDescription>
                                You've finished all {gameInfo?.title} tasks for Kid Level {userProfile.kid_level}.
                                {nextGameSuggestion && nextGameSuggestion !== "all complete" && (
                                    <>
                                        <br /> Try playing <strong>{nextGameSuggestion}</strong> to continue your progress!
                                    </>
                                )}
                                {nextGameSuggestion === "all complete" && (
                                    <>
                                        <br /> You've completed all missions for Kid Level {userProfile.kid_level}!
                                    </>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}
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
             {playableLevel === null && userProfile && (
                <Alert className="mt-4 text-left">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>All Levels Complete!</AlertTitle>
                    <AlertDescription>
                        You've finished all available levels for this game. 
                        {nextGameSuggestion && nextGameSuggestion !== "all complete" && (
                            <>
                                <br /> Try playing <strong>{nextGameSuggestion}</strong> to continue your progress!
                            </>
                        )}
                        {nextGameSuggestion === "all complete" && (
                            <>
                                <br /> You've completed all missions for Kid Level {userProfile.kid_level}!
                            </>
                        )}
                    </AlertDescription>
                </Alert>
            )}
             <Button size="lg" onClick={handleNextLevel} disabled={playableLevel === null}>
                <ArrowRight className="mr-2 h-5 w-5" />
                Continue
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

    

    