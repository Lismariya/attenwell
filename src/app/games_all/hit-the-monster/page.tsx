
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
import { Play, RefreshCw, Trophy, ArrowRight, RotateCcw, PauseIcon, Square } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { GhostIcon, RabbitIcon } from '@/components/game-icons';
import Image from 'next/image';
import { games } from '@/lib/games';
import { Hole } from '@/components/Hole';

const friendlyCharacters: React.ElementType[] = [RabbitIcon];

const APPEAR_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/ghost.mp3?alt=media&token=a607f14a-5544-4f45-803f-8313a7c16fd9';
const HIT_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/hammer-smash-effect-382731.mp3?alt=media&token=3573b478-497e-43e5-9d41-2dcab6a49a3f';
const MONSTER_HIT_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/slap.mp3?alt=media&token=4a19ced6-6687-40da-bd41-36aeb687069a';
const RABBIT_HIT_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/ooh-4-82986.mp3?alt=media&token=048c3cdf-5bef-4546-8b8e-3fbe26021204';
const LEVEL_COMPLETE_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/crowd-cheering-383111.mp3?alt=media&token=ebc76a39-6400-4b39-ac6a-f7d437f07744';

type CharacterType = 'monster' | 'friendly';
type Character = {
  type: CharacterType;
  Icon: React.ElementType;
};

type HoleState = {
  id: number;
  character: Character | null;
  timerId?: NodeJS.Timeout;
};

type ScoreFeedback = {
  id: number;
  value: number;
  index: number;
};

const levelConfig = [
    { holes: 2, monsters: 5, friendlies: 2, duration: 3000 },
    { holes: 2, monsters: 6, friendlies: 2, duration: 3000 },
    { holes: 3, monsters: 7, friendlies: 3, duration: 3000 },
    { holes: 3, monsters: 8, friendlies: 3, duration: 2500 },
    { holes: 4, monsters: 10, friendlies: 4, duration: 2500 },
    { holes: 6, monsters: 12, friendlies: 4, duration: 2000 },
    { holes: 6, monsters: 15, friendlies: 5, duration: 2000 },
    { holes: 9, monsters: 18, friendlies: 6, duration: 1500 },
    { holes: 9, monsters: 20, friendlies: 7, duration: 1500 },
    { holes: 9, monsters: 25, friendlies: 8, duration: 1000 },
];

const STORAGE_KEY_HIGH_LEVEL = 'hitTheMonster_highLevel';
const STORAGE_KEY_LAST_PLAYS = 'hitTheMonster_lastPlays';

function MonsterHole({
  character,
  onClick,
}: {
  character: Character | null;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center",
        character ? 'cursor-pointer' : 'cursor-default'
      )}
      onClick={onClick}
    >
      <Hole className="w-full h-auto" />
       {character && (
        <div className="absolute inset-0 flex justify-center" style={{ top: '0%'}}>
            <character.Icon className={cn("w-16 h-16 sm:w-20 sm:h-20 animate-in zoom-in-95 slide-in-from-bottom-5", character.type === 'friendly' ? 'text-pink-400' : 'text-green-300')} />
        </div>
      )}
    </div>
  );
}


export default function HitTheMonsterPage() {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused' | 'finished'>('idle');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [highLevel, setHighLevel] = useState(1);
  const [lastPlays, setLastPlays] = useState<number[]>([]);
  const [monstersHit, setMonstersHit] = useState(0);
  const [friendliesHit, setFriendliesHit] = useState(0);
  const [holes, setHoles] = useState<HoleState[]>([]);
  const [scoreFeedbacks, setScoreFeedbacks] = useState<ScoreFeedback[]>([]);
  
  const charactersToPop = useRef<CharacterType[]>([]);
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  
  const gameInfo = games.find(g => g.href.includes('hit-the-monster'));
  const config = levelConfig[level - 1] || levelConfig[levelConfig.length - 1];
  const passedLevel = monstersHit >= config.monsters && friendliesHit === 0;

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
            appear: new Audio(APPEAR_SOUND_URL),
            hit: new Audio(HIT_SOUND_URL),
            monsterHit: new Audio(MONSTER_HIT_SOUND_URL),
            rabbitHit: new Audio(RABBIT_HIT_SOUND_URL),
            levelComplete: new Audio(LEVEL_COMPLETE_SOUND_URL),
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

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if(gameLoopRef.current) {
        clearTimeout(gameLoopRef.current);
        gameLoopRef.current = null;
    }
  }, []);

  const handleEndGame = useCallback(() => {
    if (gameState !== 'playing') return;
    
    setGameState('finished');
    clearAllTimers();
    const isLevelPassed = monstersHit >= (levelConfig[level - 1] || levelConfig[levelConfig.length - 1]).monsters && friendliesHit === 0;
    
    if (isLevelPassed) {
        playSound('levelComplete');
    }

    if (isLevelPassed && level >= highLevel) {
        const newHigh = level + 1;
        setHighLevel(newHigh);
        localStorage.setItem(STORAGE_KEY_HIGH_LEVEL, newHigh.toString());
    }

    const newLastPlays = [score, ...lastPlays].slice(0, 5);
    setLastPlays(newLastPlays);
    localStorage.setItem(STORAGE_KEY_LAST_PLAYS, JSON.stringify(newLastPlays));
  }, [score, highLevel, lastPlays, clearAllTimers, gameState, level, playSound, monstersHit, friendliesHit]);


  const hideCharacter = useCallback((index: number) => {
    setHoles(prevHoles => {
      const newHoles = [...prevHoles];
      if (newHoles[index]?.character) {
         if(newHoles[index].timerId) {
             clearTimeout(newHoles[index].timerId);
         }
        newHoles[index] = { ...newHoles[index], character: null };
      }
      return newHoles;
    });
  }, []);

  const popCharacter = useCallback(() => {
    if (gameState !== 'playing' || charactersToPop.current.length === 0) {
      if(charactersToPop.current.length === 0 && gameState === 'playing'){
         handleEndGame();
      }
      return;
    }
    
    const availableHoles = holes.map((h, i) => (h.character === null ? i : -1)).filter(i => i !== -1);
    if (availableHoles.length === 0) return;
    
    const holeIndex = availableHoles[Math.floor(Math.random() * availableHoles.length)];
    
    const charIndex = Math.floor(Math.random() * charactersToPop.current.length);
    const characterType = charactersToPop.current.splice(charIndex, 1)[0];

    const isMonster = characterType === 'monster';
    const CharacterIcon = isMonster ? GhostIcon : friendlyCharacters[Math.floor(Math.random() * friendlyCharacters.length)];
    
    const duration = config.duration;
    
    const timerId = setTimeout(() => {
      hideCharacter(holeIndex);
    }, duration);

    setHoles(prevHoles => {
      const newHoles = [...prevHoles];
      newHoles[holeIndex] = {
        ...newHoles[holeIndex],
        character: { type: characterType, Icon: CharacterIcon },
        timerId,
      };
      return newHoles;
    });
    playSound('appear');
  }, [holes, hideCharacter, config.duration, gameState, playSound, handleEndGame]);

  const scheduleNextPop = useCallback(() => {
    if (gameState !== 'playing') return;
    const popDelay = 500 + Math.random() * 1000;
    gameLoopRef.current = setTimeout(() => {
        popCharacter();
        if (charactersToPop.current.length > 0) {
            scheduleNextPop();
        } else {
           gameLoopRef.current = setTimeout(() => handleEndGame(), config.duration);
        }
    }, popDelay);
  }, [config.duration, handleEndGame, popCharacter, gameState]);
  
  useEffect(() => {
    if (gameState === 'playing') {
      scheduleNextPop();
    } else {
      clearAllTimers();
    }
    return () => clearAllTimers();
  }, [gameState, scheduleNextPop, clearAllTimers]);

  const handleStartGame = () => {
    setLevel(highLevel);
    startGameForLevel(highLevel);
  };
  
  const startGameForLevel = (levelToStart: number) => {
    const currentConfig = levelConfig[levelToStart - 1] || levelConfig[levelConfig.length - 1];
    setGameState('playing');
    setScore(0);
    setMonstersHit(0);
    setFriendliesHit(0);
    setHoles(Array.from({ length: currentConfig.holes }, (_, i) => ({ id: i, character: null })));
    setScoreFeedbacks([]);
    
    const chars: CharacterType[] = [
      ...Array(currentConfig.monsters).fill('monster' as CharacterType),
      ...Array(currentConfig.friendlies).fill('friendly' as CharacterType)
    ];
    charactersToPop.current = chars.sort(() => Math.random() - 0.5);
  };

  
  const handleNextLevel = () => {
    const nextLevel = passedLevel ? level + 1 : level;
    setLevel(nextLevel);
    startGameForLevel(nextLevel);
  };
  
  const handleResetLevel = () => {
      setHighLevel(1);
      setLevel(1);
      setLastPlays([]);
      localStorage.removeItem(STORAGE_KEY_HIGH_LEVEL);
      localStorage.removeItem(STORAGE_KEY_LAST_PLAYS);
  }

  const showScoreFeedback = (value: number, index: number) => {
    const newFeedback = { id: Date.now(), value, index };
    setScoreFeedbacks(currentFeedbacks => [...currentFeedbacks, newFeedback]);
    setTimeout(() => {
      setScoreFeedbacks(currentFeedbacks =>
        currentFeedbacks.filter(fb => fb.id !== newFeedback.id)
      );
    }, 1000);
  };

  const handleHoleClick = (index: number) => {
    if (gameState !== 'playing' || !holes[index]?.character) return;
    
    const clickedHole = holes[index];
    hideCharacter(index);
    playSound('hit');
    
    if (clickedHole.character?.type === 'monster') {
        setScore(prev => prev + 10);
        setMonstersHit(prev => prev + 1);
        playSound('monsterHit');
        showScoreFeedback(10, index);
    } else if (clickedHole.character?.type === 'friendly') {
        setFriendliesHit(prev => prev + 1);
        setScore(prev => Math.max(0, prev - 20));
        playSound('rabbitHit');
        showScoreFeedback(-20, index);
    }
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

  const gridClass = (holeCount: number) => {
    if (holeCount <= 4) return 'grid-cols-2';
    if (holeCount <= 6) return 'grid-cols-3';
    return 'grid-cols-3';
  }

  return (
    <Card className="w-full max-w-xl mx-auto">
      <CardContent className="flex flex-col items-center justify-center gap-6 p-2 sm:p-4 md:p-6 min-h-[500px]">
        {gameState === 'idle' && (
           <div className="flex flex-col items-center gap-4 text-center">
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
                    <Button size="lg" onClick={handleStartGame}>
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
                                    This will reset your highest level and last plays. You cannot undo this action.
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

        {(gameState === 'playing' || gameState === 'paused') && (
          <>
            <div className="flex justify-between w-full text-base md:text-lg font-semibold px-4">
              <span>Level: {level}</span>
              <span>Score: {score}</span>
            </div>
             <div className="flex justify-between w-full text-base md:text-lg font-semibold px-4">
                <span>Monsters Hit: {monstersHit} / {config.monsters}</span>
                <span>Rabbits Hit: {friendliesHit}</span>
            </div>
            <div className="relative w-full aspect-square max-w-md bg-[#a2d168] rounded-lg p-4">
              <div className={cn("grid gap-x-2 sm:gap-x-8 gap-y-4 justify-items-center", gridClass(config.holes))}>
                {holes.map((hole, i) => (
                  <MonsterHole
                    key={hole.id}
                    character={hole.character}
                    onClick={() => handleHoleClick(i)}
                  />
                ))}
                {scoreFeedbacks.map(feedback => (
                  <div
                    key={feedback.id}
                    className={cn(
                      'absolute pointer-events-none text-2xl font-bold animate-out fade-out-0 duration-1000',
                      feedback.value > 0 ? 'text-green-500' : 'text-red-500',
                      'transition-all ease-out'
                    )}
                    style={{
                      left: `${(feedback.index % 3) * 33.33 + 12}%`,
                      top: `${Math.floor(feedback.index / 3) * 33.33 + 5}%`,
                      transform: 'translateY(-20px)',
                    }}
                  >
                    {feedback.value > 0 ? `+${feedback.value}` : feedback.value}
                  </div>
                ))}
              </div>
              {gameState === 'paused' && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <h2 className="text-4xl sm:text-6xl font-bold text-white animate-pulse">PAUSED</h2>
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
          </>
        )}

        {gameState === 'finished' && (
           <div className="text-center flex flex-col items-center gap-4 p-4 bg-card rounded-lg shadow-sm w-full">
            <h3 className="text-xl md:text-2xl font-headline">Level {passedLevel ? 'Complete!' : 'Failed'}</h3>
            <div className='grid grid-cols-2 gap-4 w-full max-w-sm text-center'>
                <div className='bg-green-100 p-2 rounded-md'>
                    <p className='font-bold text-green-700'>Monsters Hit</p>
                    <p className='text-lg font-bold text-green-700'>{monstersHit} / {config.monsters}</p>
                </div>
                 <div className='bg-red-100 p-2 rounded-md'>
                    <p className='font-bold text-red-700'>Rabbits Hit</p>
                    <p className='text-lg font-bold text-red-700'>{friendliesHit}</p>
                </div>
            </div>
            
            <p className="text-2xl md:text-3xl mt-4">Final Score: <span className='font-bold text-primary'>{score}</span></p>
            
            {passedLevel ? (
              <p className='text-yellow-500 font-bold'>You passed the level!</p>
            ) : (
              <p className='text-red-500 font-bold'>You need to hit {config.monsters} monsters and 0 rabbits to pass.</p>
            )}
            
            <div className='flex gap-4 mt-4'>
                <Button size="lg" onClick={handleNextLevel}>
                    {passedLevel ? 'Next Level' : 'Try Again'}
                    {passedLevel && <ArrowRight className="ml-2 h-5 w-5" />}
                    {!passedLevel && <RefreshCw className="mr-2 h-5 w-5" />}
                </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

    