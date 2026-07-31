
'use client';

import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Play, RotateCcw, Trophy, RefreshCw, ArrowRight, Loader2, PauseIcon, Square, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { games } from '@/lib/games';
import { cn } from '@/lib/utils';
import { CoinIcon, BombIcon, CarbonIcon } from '@/components/catch-game-icons';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, increment, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KID_LEVELS_CONFIG, getNextMission, isLevelUnlocked } from '@/lib/levels';
import { useProgression } from '@/hooks/useProgression';
import type { UserProfile } from '@/types/user';


const STORAGE_KEY_HIGH_LEVEL = 'catchTheRightOne_highLevel';
const STORAGE_KEY_GAME_HISTORY = 'game_history';

const BGM_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/bgm.mp3?alt=media&token=8faa92eb-4f87-4051-92e2-270441479790';
const COIN_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/coin.mp3?alt=media&token=96b565f8-b34d-4589-9bab-97a7491d9abd';
const CARBON_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/rock.mp3?alt=media&token=ac31fd43-e78f-43fc-9c1a-915c4d24055d';
const BOMB_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/explode.mp3?alt=media&token=632da777-12fc-4440-a202-808096fba56a';
const LEVEL_COMPLETE_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/crowd-cheering-383111.mp3?alt=media&token=ebc76a39-6400-4b39-ac6a-f7d437f07744';
const BACKGROUND_IMAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/background.jpg?alt=media&token=07a15431-c6f1-4bfd-94d9-141e6d3b8ea1';


type GameObjectType = 'coin' | 'bomb' | 'carbon';
type GameObject = {
    id: number;
    type: GameObjectType;
    x: number;
    y: number;
    speed: number;
    rotation: number;
    size: number;
};
type ScoreFeedback = {
  key: number;
  value: number;
  x: number;
  y: number;
};

const levelConfig = [
  { speedMultiplier: 0.5, coins: 3, carbons: 2, bombs: 0 }, // Level 1
  { speedMultiplier: 0.75, coins: 4, carbons: 3, bombs: 1 }, // Level 2
  { speedMultiplier: 1.0, coins: 5, carbons: 4, bombs: 1 }, // Level 3
];

const objectTypes: { type: GameObjectType, Icon: React.ElementType, value: number, soundUrl: string }[] = [
    { type: 'coin', Icon: CoinIcon, value: 10, soundUrl: COIN_SOUND_URL },
    { type: 'carbon', Icon: CarbonIcon, value: -5, soundUrl: CARBON_SOUND_URL },
    { type: 'bomb', Icon: BombIcon, value: 0, soundUrl: BOMB_SOUND_URL },
];


export default function CatchTheRightOnePage() {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused' | 'gameOverOnCanvas' | 'levelComplete' | 'finished'>('idle');
  const [coins, setCoins] = useState(0);
  const [level, setLevel] = useState(1);
  const [objects, setObjects] = useState<GameObject[]>([]);
  const [scoreFeedback, setScoreFeedback] = useState<ScoreFeedback | null>(null);
  const [explodingBombId, setExplodingBombId] = useState<number | null>(null);
  
  const [totalObjectsForLevel, setTotalObjectsForLevel] = useState(0);
  const [clearedObjects, setClearedObjects] = useState(0);
  const [tappedCoins, setTappedCoins] = useState(0);
  const [tappedCarbons, setTappedCarbons] = useState(0);
  const [tappedBombs, setTappedBombs] = useState(0);
  const [isBgLoaded, setIsBgLoaded] = useState(false);
  const [nextGameSuggestion, setNextGameSuggestion] = useState<string | null>(null);
  const [playableLevel, setPlayableLevel] = useState<number | null>(null);

  const gameInfo = games.find(g => g.href.includes('catch-the-right-one'));
  const animationFrameRef = useRef<number>();
  const objectSpawnTimers = useRef<NodeJS.Timeout[]>([]);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout>();
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const gameAreaRef = useRef<HTMLDivElement>(null);

  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { checkAndAdvanceKidLevel } = useProgression();

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

  
  const config = levelConfig[level - 1] || levelConfig[levelConfig.length - 1];
  const passedLevel = tappedCoins === config.coins && tappedCarbons === 0;

  useEffect(() => {
    if (typeof window !== 'undefined') {
       audioRefs.current = {
        bgm: new Audio(BGM_URL),
        coin: new Audio(COIN_SOUND_URL),
        carbon: new Audio(CARBON_SOUND_URL),
        bomb: new Audio(BOMB_SOUND_URL),
        levelComplete: new Audio(LEVEL_COMPLETE_SOUND_URL),
      };
      audioRefs.current.bgm.loop = true;

      Object.values(audioRefs.current).forEach(audio => {
          audio.load();
      });

      const bgImage = new window.Image();
      bgImage.src = BACKGROUND_IMAGE_URL;
      bgImage.onload = () => {
        setIsBgLoaded(true);
      };
    }

    return () => {
        Object.values(audioRefs.current).forEach(audio => {
            if (audio && !audio.paused) {
                audio.pause();
            }
        });
    }
  }, []);

  const playSound = useCallback(async (soundName: keyof typeof audioRefs.current) => {
    const audio = audioRefs.current[soundName];
    if (audio) {
      audio.currentTime = 0;
      try {
        await audio.play();
      } catch (error) {
        if ((error as DOMException).name !== 'AbortError') {
          console.error(`Error playing ${soundName} sound:`, error);
        }
      }
    }
  }, []);

  const updateProgress = useCallback(async () => {
    if (!userDocRef || !gameInfo || !firestore) return;

    const coinsEarned = coins;

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
  }, [userDocRef, firestore, gameInfo, level, coins, toast, checkAndAdvanceKidLevel]);


  const showScoreFeedback = (value: number, x: number, y: number) => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setScoreFeedback({ key: Date.now(), value, x, y });
    feedbackTimeoutRef.current = setTimeout(() => setScoreFeedback(null), 1000);
  };
  
  const clearAllTimers = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    objectSpawnTimers.current.forEach(clearTimeout);
    objectSpawnTimers.current = [];
  }, []);

  const finishLevel = useCallback(async () => {
     if (gameState !== 'playing') return;
     clearAllTimers();
     if(passedLevel) {
        playSound('levelComplete');
        await updateProgress();
        saveGameHistory('Passed');
        
        // Re-check for next mission after progress update
        const nextMission = getNextMission(userProfile, gameInfo?.title || "");
        if (!nextMission) {
            setNextGameSuggestion("all complete");
        } else if (typeof nextMission === 'string') {
            setNextGameSuggestion(nextMission);
        }

     } else {
        saveGameHistory('Failed');
     }
     setGameState('levelComplete');
  }, [passedLevel, clearAllTimers, gameState, playSound, updateProgress, userProfile, gameInfo, saveGameHistory]);

  useEffect(() => {
    if (gameState === 'playing' && totalObjectsForLevel > 0 && clearedObjects >= totalObjectsForLevel && objects.length === 0) {
      finishLevel();
    }
  }, [clearedObjects, totalObjectsForLevel, objects.length, gameState, finishLevel]);


  const startNewLevel = useCallback((levelNum: number) => {
    setLevel(levelNum);
    
    if (!gameAreaRef.current) return;
    const gameAreaWidth = gameAreaRef.current.offsetWidth;
    const objectSize = gameAreaWidth * 0.15; 

    const config = levelConfig[levelNum - 1] || levelConfig[levelConfig.length - 1];
    setTotalObjectsForLevel(config.coins + config.carbons + config.bombs);

    const objectsToSpawn: { type: GameObjectType }[] = [
        ...Array(config.coins).fill({ type: 'coin' }),
        ...Array(config.carbons).fill({ type: 'carbon' }),
        ...Array(config.bombs).fill({ type: 'bomb' }),
    ].sort(() => Math.random() - 0.5);

    objectSpawnTimers.current = objectsToSpawn.map((objInfo, index) => 
        setTimeout(() => {
            if (gameState !== 'playing') return;
            setObjects(prev => {
                let newX;
                let attempts = 0;
                do {
                    newX = Math.random() * (gameAreaWidth - objectSize);
                    attempts++;
                } while (
                    prev.some(obj => Math.abs(obj.x - newX) < objectSize && obj.y < objectSize) && attempts < 10
                );

                const newObject: GameObject = {
                    id: Date.now() + Math.random(),
                    type: objInfo.type,
                    x: newX,
                    y: -objectSize,
                    speed: (Math.random() * 0.5 + 0.5) * config.speedMultiplier * 0.75,
                    rotation: Math.random() * 360,
                    size: objectSize,
                };
                return [...prev, newObject];
            });
        }, index * (2000 / config.speedMultiplier))
    );
  }, [gameState]);

  const gameLoop = useCallback(() => {
    if (!gameAreaRef.current || gameState !== 'playing') return;
    const gameAreaHeight = gameAreaRef.current.offsetHeight;
    
    setObjects(prev => {
        const updatedObjects = prev.map(obj => ({
            ...obj,
            y: obj.y + obj.speed,
        }));
        
        const onscreenObjects = updatedObjects.filter(obj => {
          if (obj.y < gameAreaHeight) {
            return true;
          } else {
            // Object is off-screen
            setClearedObjects(c => c + 1);
            return false;
          }
        });
        return onscreenObjects;
    });
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [gameState]);


  const handleStartGame = () => {
    if (playableLevel === null) return;
    setCoins(0);
    setObjects([]);
    setExplodingBombId(null);
    setClearedObjects(0);
    setTotalObjectsForLevel(0);
    setTappedCoins(0);
    setTappedCarbons(0);
    setTappedBombs(0);
    setGameState('playing');
  };

  useEffect(() => {
    if (gameState === 'playing' && playableLevel) {
      startNewLevel(playableLevel);
      if (audioRefs.current.bgm && audioRefs.current.bgm.paused) {
        playSound('bgm');
      }
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    } else {
      clearAllTimers();
       if (audioRefs.current.bgm && !audioRefs.current.bgm.paused) {
          audioRefs.current.bgm.pause();
          if (gameState === 'idle' || gameState === 'finished' || gameState === 'levelComplete') {
             audioRefs.current.bgm.currentTime = 0;
          }
      }
    }
    return () => {
        clearAllTimers();
    }
  }, [gameState, playableLevel, startNewLevel, playSound, gameLoop, clearAllTimers]);

  const handleObjectClick = (object: GameObject) => {
    if (gameState !== 'playing') return;

    const objectInfo = objectTypes.find(o => o.type === object.type);
    if (!objectInfo) return;

    playSound(object.type as 'coin' | 'carbon' | 'bomb');

    if (object.type === 'bomb') {
      setTappedBombs(prev => prev + 1);
      setExplodingBombId(object.id);
      setGameState('gameOverOnCanvas');
      setObjects(prev => prev.filter(o => o.id === object.id));
      clearAllTimers();
      saveGameHistory('Failed (Bomb)');
      
      setTimeout(() => {
        setGameState('finished');
      }, 2000);
      return;
    }

    if (object.type === 'coin') {
        setTappedCoins(prev => prev + 1);
    } else if (object.type === 'carbon') {
        setTappedCarbons(prev => prev + 1);
    }
    
    setCoins(prev => Math.max(0, prev + objectInfo.value));
    showScoreFeedback(objectInfo.value, object.x, object.y);
    setObjects(prev => prev.filter(o => o.id !== object.id));
    setClearedObjects(c => c + 1);
  };
  
  const handlePlayAgain = () => {
    setGameState('idle');
  }
  
  const handleNextLevel = () => {
    setClearedObjects(0);
    setTotalObjectsForLevel(0);
    setTappedCoins(0);
    setTappedCarbons(0);
    setTappedBombs(0);
    setObjects([]);
    setGameState('idle'); // Go to idle to re-evaluate the next playable level
  };

  const handlePauseResumeGame = () => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  };

  const handleStopGame = () => {
    setGameState('idle');
  };

  return (
    <Card className="w-full max-w-xl mx-auto bg-transparent border-none shadow-none">
      <CardContent className="flex flex-col items-center justify-center gap-6 p-0">
        {gameState === 'idle' && (
             <div className="flex flex-col items-center gap-4 text-center p-4 bg-card rounded-lg shadow-sm">
             {gameInfo?.imageUrl && (
                <Image
                    src={gameInfo.imageUrl}
                    alt={gameInfo.title}
                    width={150}
                    height={150}
                    className="rounded-full border-4 border-white shadow-lg"
                />
            )}
            <h2 className="text-3xl font-bold font-headline mt-4">{gameInfo?.title}</h2>
            <p className="text-muted-foreground">Kid Level: {userProfile?.kid_level || 1}</p>
            {playableLevel !== null && <p className="text-lg font-semibold">Next up: Level {playableLevel}</p>}

             <div className="flex flex-col items-center justify-center gap-4 mt-6">
                <Button size="lg" onClick={handleStartGame} disabled={!isBgLoaded || isProfileLoading || isUserLoading || playableLevel === null}>
                    {isUserLoading || isProfileLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
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
        {(gameState === 'playing' || gameState === 'paused' || gameState === 'gameOverOnCanvas') && (
            <div className='w-full flex flex-col items-center gap-2'>
                 <div className="w-full flex justify-between items-center text-lg font-semibold px-2">
                    <span>Level: {level}</span>
                    <div className="flex items-center gap-1">
                        <CoinIcon className="w-6 h-6" />
                        <span>{coins}</span>
                    </div>
                </div>
                <div
                    ref={gameAreaRef} 
                    className="relative w-full aspect-[3/4] max-w-full rounded-lg overflow-hidden border-2 border-primary"
                    style={{ 
                        backgroundImage: `url(${BACKGROUND_IMAGE_URL})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                     }}
                >
                    {objects.map(obj => {
                        const ObjectIcon = objectTypes.find(o => o.type === obj.type)?.Icon;
                        const isExploding = obj.id === explodingBombId;
                        return ObjectIcon ? (
                            <div
                                key={obj.id}
                                className={cn("absolute", {"cursor-pointer": gameState === 'playing'}, {"animate-explode": isExploding})}
                                style={{
                                    left: obj.x,
                                    top: obj.y,
                                    width: obj.size,
                                    height: obj.size,
                                    transform: `rotate(${obj.rotation}deg)`,
                                }}
                                onClick={() => handleObjectClick(obj)}
                            >
                                <ObjectIcon className="w-full h-full" />
                            </div>
                        ) : null;
                    })}
                     {gameState === 'gameOverOnCanvas' && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <h2 className="text-4xl font-bold text-red-500 animate-pulse">GAME OVER</h2>
                        </div>
                    )}
                     {gameState === 'paused' && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <h2 className="text-4xl font-bold text-white animate-pulse">PAUSED</h2>
                        </div>
                    )}
                     {scoreFeedback && (
                        <div
                            key={scoreFeedback.key}
                            className={cn(
                                'absolute pointer-events-none text-xl font-bold animate-out fade-out-0 duration-1000',
                                scoreFeedback.value > 0 ? 'text-green-400' : 'text-red-500',
                                'transition-all ease-out'
                            )}
                            style={{
                                left: scoreFeedback.x,
                                top: scoreFeedback.y,
                                transform: 'translateY(-20px)',
                                textShadow: '0 0 5px black'
                            }}
                        >
                            {scoreFeedback.value > 0 ? `+${scoreFeedback.value}` : scoreFeedback.value}
                        </div>
                    )}
                </div>
                 <div className="w-full flex justify-center items-center text-lg font-semibold px-2 mt-2">
                    <div className='flex items-center gap-2'>
                       <Button size="icon" variant="outline" onClick={handlePauseResumeGame}>
                          {gameState === 'playing' ? <PauseIcon className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      </Button>
                       <Button size="icon" variant="outline" onClick={handleStopGame}>
                          <Square className="h-5 w-5" />
                      </Button>
                    </div>
                </div>
            </div>
        )}
        {gameState === 'levelComplete' && (
            <div className="text-center flex flex-col items-center gap-4 p-4 bg-card rounded-lg shadow-sm w-full">
                <h3 className="text-xl font-headline">Level {passedLevel ? 'Complete!' : 'Failed'}</h3>
                <div className='grid grid-cols-2 gap-4 w-full max-w-sm text-center'>
                    <div className='bg-green-100 p-2 rounded-md'>
                        <p className='font-bold text-green-700'>Coins Tapped</p>
                        <p className='text-lg font-bold text-green-700'>{tappedCoins} / {config.coins}</p>
                    </div>
                    <div className='bg-red-100 p-2 rounded-md'>
                        <p className='font-bold text-red-700'>Stones Tapped</p>
                        <p className='text-lg font-bold text-red-700'>{tappedCarbons}</p>
                    </div>
                </div>

                 <p className="text-2xl mt-4">Coins Earned: <span className='font-bold text-primary'>{coins}</span></p>
                
                {passedLevel ? (
                    <p className='text-yellow-500 font-bold'>You passed the level!</p>
                ) : (
                  <p className='text-red-500 font-bold'>You must hit all coins and no stones to pass.</p>
                )}
                
                <Button size="lg" onClick={handleNextLevel} className='mt-4'>
                    {passedLevel ? <ArrowRight className="mr-2 h-5 w-5" /> : <RefreshCw className="mr-2 h-5 w-5" />}
                    {passedLevel ? 'Continue' : 'Try Again'}
                </Button>
            </div>
        )}
         {gameState === 'finished' && (
            <div className="text-center flex flex-col items-center gap-4 p-4 bg-card rounded-lg shadow-sm w-full">
                <h3 className="text-xl font-headline">Game Over!</h3>
                {tappedBombs > 0 && <p className="text-red-500 font-bold">You tapped a bomb!</p>}
                <p className="text-2xl">Final Coins: <span className='font-bold text-primary'>{coins}</span></p>
                <p className="text-muted-foreground">You reached level {level}.</p>
                <Button size="lg" onClick={handlePlayAgain} className='mt-4'>
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Play Again
                </Button>
            </div>
        )}
      </CardContent>
    </Card>
  );
}

    

    