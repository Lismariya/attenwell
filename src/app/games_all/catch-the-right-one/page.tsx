
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
import { Play, RotateCcw, Trophy, RefreshCw, ArrowRight, Loader2, PauseIcon, Square } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { games } from '@/lib/games';
import { cn } from '@/lib/utils';
import { CoinIcon, BombIcon, CarbonIcon } from '@/components/catch-game-icons';

const STORAGE_KEY_HIGH_LEVEL = 'catchTheRightOne_highLevel';
const STORAGE_KEY_LAST_PLAYS = 'catchTheRightOne_lastPlays';

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
  { speedMultiplier: 0.5, coins: 3, carbons: 3, bombs: 1 },
  { speedMultiplier: 0.75, coins: 3, carbons: 3, bombs: 1 },
  { speedMultiplier: 1.0, coins: 3, carbons: 3, bombs: 1 },
  { speedMultiplier: 2.0, coins: 3, carbons: 3, bombs: 1 },
  { speedMultiplier: 0.75, coins: 6, carbons: 6, bombs: 2 },
  { speedMultiplier: 1.0, coins: 6, carbons: 6, bombs: 2 },
  { speedMultiplier: 1.5, coins: 6, carbons: 6, bombs: 2 },
  { speedMultiplier: 1.0, coins: 8, carbons: 8, bombs: 3 },
  { speedMultiplier: 1.5, coins: 8, carbons: 8, bombs: 3 },
  { speedMultiplier: 2.0, coins: 10, carbons: 10, bombs: 4 },
];

const objectTypes: { type: GameObjectType, Icon: React.ElementType, value: number, soundUrl: string }[] = [
    { type: 'coin', Icon: CoinIcon, value: 10, soundUrl: COIN_SOUND_URL },
    { type: 'carbon', Icon: CarbonIcon, value: -5, soundUrl: CARBON_SOUND_URL },
    { type: 'bomb', Icon: BombIcon, value: 0, soundUrl: BOMB_SOUND_URL },
];


export default function CatchTheRightOnePage() {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused' | 'gameOverOnCanvas' | 'levelComplete' | 'finished'>('idle');
  const [highLevel, setHighLevel] = useState(1);
  const [lastPlays, setLastPlays] = useState<number[]>([]);
  const [score, setScore] = useState(0);
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

  const gameInfo = games.find(g => g.href.includes('catch-the-right-one'));
  const animationFrameRef = useRef<number>();
  const objectSpawnTimers = useRef<NodeJS.Timeout[]>([]);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout>();
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const gameAreaRef = useRef<HTMLDivElement>(null);
  
  const config = levelConfig[level - 1] || levelConfig[levelConfig.length - 1];
  const passedLevel = tappedCoins === config.coins && tappedCarbons === 0;

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

  const finishLevel = useCallback(() => {
     if (gameState !== 'playing') return;
     clearAllTimers();
     if(passedLevel) playSound('levelComplete');
     setGameState('levelComplete');
  }, [passedLevel, clearAllTimers, gameState, playSound]);

  useEffect(() => {
    if (gameState === 'playing' && totalObjectsForLevel > 0 && clearedObjects >= totalObjectsForLevel && objects.length === 0) {
      finishLevel();
    }
  }, [clearedObjects, totalObjectsForLevel, objects.length, gameState, finishLevel]);


  const startNewLevel = useCallback((levelNum: number) => {
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
    setScore(0);
    setLevel(highLevel);
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
    if (gameState === 'playing') {
      startNewLevel(level);
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
  }, [gameState, level, startNewLevel, playSound, gameLoop, clearAllTimers]);

  const handleObjectClick = (object: GameObject) => {
    if (gameState !== 'playing') return;

    const objectInfo = objectTypes.find(o => o.type === object.type);
    if (!objectInfo) return;

    playSound(object.type as 'coin' | 'carbon' | 'bomb');

    if (object.type === 'bomb') {
      setTappedBombs(prev => prev + 1);
      setExplodingBombId(object.id);
      setGameState('gameOverOnCanvas');
      setObjects(prev => prev.filter(o => o.id === object.id)); // Keep only the bomb to explode
      clearAllTimers();
      
      const newLastPlays = [score, ...lastPlays].slice(0, 5);
      setLastPlays(newLastPlays);
      localStorage.setItem(STORAGE_KEY_LAST_PLAYS, JSON.stringify(newLastPlays));
      
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
    
    setScore(prev => Math.max(0, prev + objectInfo.value));
    showScoreFeedback(objectInfo.value, object.x, object.y);
    setObjects(prev => prev.filter(o => o.id !== object.id));
    setClearedObjects(c => c + 1);
  };
  
  const handlePlayAgain = () => {
    setGameState('idle');
  }

  const handleResetScore = () => {
    setHighLevel(1);
    setLevel(1);
    setLastPlays([]);
    localStorage.removeItem(STORAGE_KEY_HIGH_LEVEL);
    localStorage.removeItem(STORAGE_KEY_LAST_PLAYS);
  };
  
  const handleNextLevel = () => {
    if (passedLevel) {
        const newLevel = level + 1;
        setLevel(newLevel);
        if (newLevel > highLevel) {
            setHighLevel(newLevel);
            localStorage.setItem(STORAGE_KEY_HIGH_LEVEL, newLevel.toString());
        }
    }
    setClearedObjects(0);
    setTotalObjectsForLevel(0);
    setTappedCoins(0);
    setTappedCarbons(0);
    setTappedBombs(0);
    setObjects([]);
    setGameState('playing');
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
      <CardContent className="flex flex-col items-center justify-center gap-6 p-0 sm:p-4">
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
            <div className="flex items-center gap-4 text-xl font-semibold bg-muted p-2 px-4 rounded-full">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <span>Highest Level: {highLevel}</span>
            </div>

            {lastPlays.length > 0 && (
                <div className="mt-4 w-full max-w-xs">
                    <h3 className="font-semibold text-lg">Last Scores</h3>
                    <ul className="mt-2 space-y-1 text-base">
                        {lastPlays.map((playScore, index) => (
                            <li key={index} className="flex justify-between items-center bg-muted/50 p-2 rounded-md">
                                <span>Play {index + 1}</span>
                                <span className="font-bold">{playScore}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
             <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
                <Button size="lg" onClick={handleStartGame} disabled={!isBgLoaded}>
                    {isBgLoaded ? (
                        <>
                            <Play className="mr-2 h-5 w-5" />
                            Start Game
                        </>
                    ) : (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Loading Assets...
                        </>
                    )}
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <Button size="lg" variant="outline">
                             <RotateCcw className="mr-2 h-5 w-5" />
                             Reset Score
                         </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will reset your highest level and last plays. You cannot undo this action.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleResetScore}>Confirm</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              </div>
          </div>
        )}
        {(gameState === 'playing' || gameState === 'paused' || gameState === 'gameOverOnCanvas') && (
            <div className='w-full flex flex-col items-center gap-2'>
                 <div className="w-full flex justify-between items-center text-lg font-semibold px-2">
                    <span>Level: {level}</span>
                    <span>Score: {score}</span>
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
                            <h2 className="text-4xl sm:text-6xl font-bold text-red-500 animate-pulse">GAME OVER</h2>
                        </div>
                    )}
                     {gameState === 'paused' && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <h2 className="text-4xl sm:text-6xl font-bold text-white animate-pulse">PAUSED</h2>
                        </div>
                    )}
                     {scoreFeedback && (
                        <div
                            key={scoreFeedback.key}
                            className={cn(
                                'absolute pointer-events-none text-xl sm:text-3xl font-bold animate-out fade-out-0 duration-1000',
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
                <h3 className="text-xl md:text-2xl font-headline">Level {passedLevel ? 'Complete!' : 'Failed'}</h3>
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

                <p className="text-2xl md:text-3xl mt-4">Final Score: <span className='font-bold text-primary'>{score}</span></p>
                {passedLevel ? (
                  <p className='text-yellow-500 font-bold'>You passed the level!</p>
                ) : (
                  <p className='text-red-500 font-bold'>You must hit all coins and no stones to pass.</p>
                )}
                
                {passedLevel ? (
                   <Button size="lg" onClick={handleNextLevel} className='mt-4'>
                        Next Level
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                ) : (
                    <Button size="lg" onClick={handleNextLevel} className='mt-4'>
                        <RefreshCw className="mr-2 h-5 w-5" />
                        Try Again
                    </Button>
                )}
            </div>
        )}
         {gameState === 'finished' && (
            <div className="text-center flex flex-col items-center gap-4 p-4 bg-card rounded-lg shadow-sm w-full">
                <h3 className="text-xl md:text-2xl font-headline">Game Over!</h3>
                {tappedBombs > 0 && <p className="text-red-500 font-bold">You tapped a bomb!</p>}
                <p className="text-2xl md:text-3xl">Final Score: <span className='font-bold text-primary'>{score}</span></p>
                <p className="text-muted-foreground">You reached level {level}.</p>
                {level > highLevel && level > 1 && <p className="text-yellow-400 font-bold">New Highest Level!</p>}
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
