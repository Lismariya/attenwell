
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
import { Ear, Play, RefreshCw, XCircle, CheckCircle, Trophy, Dog, Cat, Bell, ArrowRight, RotateCcw } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { games } from '@/lib/games';

const PARK_AMBIENCE_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/park.mp3?alt=media&token=79b99e6b-0e2f-40e8-a6cb-cc2ec49ee5cb';

const SOUNDS = {
    dog: {
        url: 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/dog.mp3?alt=media&token=9bf89f9c-3695-4ae5-bf8a-6aa49d894992',
        Icon: Dog
    },
    cat: {
        url: 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/cat.mp3?alt=media&token=f5915cb6-61bd-45eb-88f7-0d3e0ca3eda3',
        Icon: Cat
    },
    chimes: {
        url: 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/chimes.mp3?alt=media&token=77df89f2-0065-4828-b850-ff51b3ba6edb',
        Icon: Bell
    }
};

type TargetSound = keyof typeof SOUNDS;

const levelConfig: { targets: TargetSound[]; soundPlays: number }[] = [
    { targets: ['dog'], soundPlays: 3 },
    { targets: ['dog', 'cat'], soundPlays: 4 },
    { targets: ['dog', 'cat', 'chimes'], soundPlays: 5 },
    { targets: ['dog', 'chimes'], soundPlays: 6 }, // Example of making it trickier
    { targets: ['cat', 'chimes'], soundPlays: 7 },
    { targets: ['dog', 'cat'], soundPlays: 8 },
    { targets: ['dog', 'cat', 'chimes'], soundPlays: 8 },
    { targets: ['dog', 'chimes'], soundPlays: 9 },
    { targets: ['cat', 'chimes'], soundPlays: 9 },
    { targets: ['dog', 'cat', 'chimes'], soundPlays: 10 },
];

const STORAGE_KEY_HIGH_LEVEL = 'noiseNinjas_highLevel';
const STORAGE_KEY_LAST_PLAYS = 'noiseNinjas_lastPlays';

export default function NoiseNinjasPage() {
  const [gameState, setGameState] = useState<
    'idle' | 'instructions' | 'playing' | 'ending' | 'finished'
  >('idle');
  
  const [level, setLevel] = useState(1);
  const [highLevel, setHighLevel] = useState(1);
  const [lastPlays, setLastPlays] = useState<number[]>([]);

  const [correctTaps, setCorrectTaps] = useState(0);
  const [missedTaps, setMissedTaps] = useState(0);
  const [falseTaps, setFalseTaps] = useState(0);
  const [feedback, setFeedback] = useState<'hit' | 'miss' | null>(null);

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const soundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const canClickRef = useRef(false);
  const soundPlayCountRef = useRef(0);
  
  const audioRefs = useRef<{
    ambience?: HTMLAudioElement;
    target?: HTMLAudioElement;
  }>({});
  
  const gameInfo = games.find(g => g.href.includes('noise-ninjas'));

  const maxSoundPlays = (levelConfig[level - 1] || levelConfig[levelConfig.length - 1]).soundPlays;
  const finalScore = Math.max(0, correctTaps * 10 - (missedTaps + falseTaps) * 5);
  const passedLevel = maxSoundPlays > 0 && correctTaps / maxSoundPlays >= 0.7;

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

        audioRefs.current.ambience = new Audio(PARK_AMBIENCE_URL);
        audioRefs.current.ambience.loop = true;
        audioRefs.current.target = new Audio();
    }
     return () => {
      stopAllSounds();
    };
  }, []);

  const clearAllTimers = useCallback(() => {
    if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
    gameLoopRef.current = null;
    soundTimerRef.current = null;
  }, []);

  const stopAllSounds = useCallback(() => {
     if (audioRefs.current.ambience) {
        audioRefs.current.ambience.pause();
    }
    if (audioRefs.current.target) {
        audioRefs.current.target.pause();
    }
  }, []);

  const handleEndGame = useCallback(() => {
    if (gameState === 'ending' || gameState === 'finished') return;

    setGameState('ending');
    clearAllTimers();

    setTimeout(() => {
        const currentHighLevel = parseInt(localStorage.getItem(STORAGE_KEY_HIGH_LEVEL) || '1', 10);

        if (passedLevel && level >= currentHighLevel) {
            const nextLevel = level + 1;
            setHighLevel(nextLevel);
            localStorage.setItem(STORAGE_KEY_HIGH_LEVEL, nextLevel.toString());
        }
        
        stopAllSounds();
        if (audioRefs.current.ambience) {
            audioRefs.current.ambience.currentTime = 0;
        }
        const newLastPlays = [finalScore, ...lastPlays].slice(0, 5);
        setLastPlays(newLastPlays);
        localStorage.setItem(STORAGE_KEY_LAST_PLAYS, JSON.stringify(newLastPlays));
        setGameState('finished');
        
    }, 2000);
  }, [correctTaps, gameState, clearAllTimers, stopAllSounds, level, lastPlays, finalScore, maxSoundPlays, passedLevel]);

  const playTargetSound = (sound: TargetSound) => {
    if (audioRefs.current.target) {
        audioRefs.current.target.src = SOUNDS[sound].url;
        audioRefs.current.target.volume = 0.1;
        audioRefs.current.target.currentTime = 0;
        audioRefs.current.target.play();
    }
  };
  
  const playAmbience = () => {
    if (audioRefs.current.ambience && audioRefs.current.ambience.paused) {
        audioRefs.current.ambience.volume = 0.4;
        audioRefs.current.ambience.play().catch(e => console.error("Ambience play failed:", e));
    }
  };

  const showFeedback = (type: 'hit' | 'miss') => {
    setFeedback(type);
    setTimeout(() => setFeedback(null), 500);
  };

  const scheduleNextSound = useCallback(() => {
    clearAllTimers();
    if (soundPlayCountRef.current >= maxSoundPlays) {
        handleEndGame();
        return; 
    }
    
    const currentTargets = (levelConfig[level-1] || levelConfig[levelConfig.length - 1]).targets;
    const nextSoundDelay = Math.random() * 4000 + 3000; // 3-7 seconds

    gameLoopRef.current = setTimeout(() => {
      soundPlayCountRef.current += 1;
      const targetSound = currentTargets[Math.floor(Math.random() * currentTargets.length)];
      playTargetSound(targetSound);
      canClickRef.current = true;

      const soundDuration = 2000; // Player has 2 seconds to click
      soundTimerRef.current = setTimeout(() => {
        if (canClickRef.current) {
          // Player missed the sound
          setMissedTaps(prev => prev + 1);
          showFeedback('miss');
          canClickRef.current = false;
        }
        scheduleNextSound();
      }, soundDuration);
    }, nextSoundDelay);
  }, [handleEndGame, clearAllTimers, level, maxSoundPlays]);

  useEffect(() => {
    if (gameState === 'playing') {
      playAmbience();
      scheduleNextSound();
    } else if (gameState !== 'playing' && audioRefs.current.ambience && !audioRefs.current.ambience.paused) {
        if (!passedLevel) {
          audioRefs.current.ambience.pause();
          audioRefs.current.ambience.currentTime = 0;
        }
    }
    
    return () => {
      if (gameState === 'playing' || gameState === 'ending') {
        clearAllTimers();
      }
    };
  }, [gameState, scheduleNextSound, clearAllTimers, passedLevel]);

  const handleStartGame = () => {
    setLevel(highLevel);
    setGameState('instructions');
    setCorrectTaps(0);
    setMissedTaps(0);
    setFalseTaps(0);
    canClickRef.current = false;
    soundPlayCountRef.current = 0;
  };

  const handleStartLevel = () => {
    setGameState('playing');
  }

  const handleRestartGame = () => {
    stopAllSounds();
    setGameState('idle');
  };

  const handleNextLevel = () => {
    if (passedLevel) {
      setLevel(prev => prev + 1);
    }
    setGameState('instructions');
    setCorrectTaps(0);
    setMissedTaps(0);
    setFalseTaps(0);
    canClickRef.current = false;
    soundPlayCountRef.current = 0;
  };

  const handleSpotClick = () => {
    if (gameState !== 'playing' || !canClickRef.current) {
      if(gameState === 'playing') {
        setFalseTaps(prev => prev + 1);
        showFeedback('miss');
      }
      return;
    }

    if (canClickRef.current) {
      setCorrectTaps(prev => prev + 1);
      showFeedback('hit');
      canClickRef.current = false; 
      
      if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
      scheduleNextSound();
    }
  };

  const handleResetLevel = () => {
    setHighLevel(1);
    setLevel(1);
    localStorage.setItem(STORAGE_KEY_HIGH_LEVEL, '1');
  };

  const currentLevelConfig = levelConfig[level - 1] || levelConfig[levelConfig.length - 1];

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="flex flex-col items-center justify-center gap-6 p-4 md:p-12 min-h-[400px]">
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

        {gameState === 'instructions' && (
             <div className="text-center flex flex-col items-center gap-6">
                <h3 className="text-xl md:text-2xl font-headline">Level {level}</h3>
                <p className="text-lg text-muted-foreground">Listen for these sounds:</p>
                <div className='flex items-center justify-center gap-4'>
                    {currentLevelConfig.targets.map(target => {
                        const SoundIcon = SOUNDS[target].Icon;
                        return (
                             <div key={target} className='flex flex-col items-center gap-2 p-4 rounded-lg bg-muted'>
                                 <SoundIcon className='w-10 h-10 text-primary' />
                                 <span className='font-semibold capitalize'>{target}</span>
                            </div>
                        )
                    })}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Button size="lg" onClick={handleStartLevel}>
                      <Play className="mr-2 h-5 w-5" />
                      Begin
                  </Button>
                </div>
            </div>
        )}

        {(gameState === 'playing' || gameState === 'ending') && (
          <>
            <div className="flex justify-around w-full text-base md:text-lg font-semibold">
              <span>Level: {level}</span>
              <span>Heard: {soundPlayCountRef.current} / {maxSoundPlays}</span>
            </div>
            <div className="relative w-48 h-48 md:w-64 md:h-64 rounded-full bg-muted flex items-center justify-center transition-colors duration-300">
              <div className="text-muted-foreground text-center p-4">
                 {gameState === 'ending' ? (
                     <p className='font-bold text-lg'>Finishing up...</p>
                 ) : (
                    <>
                        <p className='font-bold text-lg'>Listen carefully...</p>
                        <p className='text-sm'>(Headphones recommended)</p>
                    </>
                 )}
              </div>
                {feedback === 'hit' && (
                  <CheckCircle className="absolute w-20 h-20 text-green-500 animate-in fade-in-0 zoom-in-50" />
                )}
                {feedback === 'miss' && (
                  <XCircle className="absolute w-20 h-20 text-red-500 animate-in fade-in-0 zoom-in-50" />
                )}
            </div>
             <div className="grid grid-cols-3 gap-2 w-full max-w-sm text-center text-xs sm:text-sm">
                <div className='bg-green-100 p-2 rounded-md'>
                    <p className='font-bold text-green-700'>Correct</p>
                    <p className='text-lg font-bold text-green-700'>{correctTaps}</p>
                </div>
                 <div className='bg-red-100 p-2 rounded-md'>
                    <p className='font-bold text-red-700'>Missed</p>
                    <p className='text-lg font-bold text-red-700'>{missedTaps}</p>
                </div>
                 <div className='bg-yellow-100 p-2 rounded-md'>
                    <p className='font-bold text-yellow-700'>False Taps</p>
                    <p className='text-lg font-bold text-yellow-700'>{falseTaps}</p>
                </div>
            </div>
            <Button size="lg" onClick={handleSpotClick} className="w-48" disabled={gameState === 'ending'}>
              I hear it!
            </Button>
          </>
        )}

        {gameState === 'finished' && (
          <div className="text-center flex flex-col items-center gap-4">
            <h3 className="text-xl md:text-2xl font-headline">Level {passedLevel ? "Complete!" : "Failed"}</h3>
            <div className='text-lg md:text-xl text-muted-foreground'>
                <p>Correct Taps: <span className='font-bold text-green-600'>{correctTaps}</span></p>
                <p>Missed Sounds: <span className='font-bold text-destructive'>{missedTaps}</span></p>
                 <p>False Taps: <span className='font-bold text-yellow-600'>{falseTaps}</span></p>
            </div>
            <p className="text-2xl md:text-3xl">Final Score: <span className='font-bold text-primary'>{finalScore}</span></p>
             {passedLevel ? (
                <p className='text-accent font-bold'>You passed the level!</p>
             ) : (
                <p className='text-red-500 font-bold'>Try again to unlock the next level.</p>
             )}
            <div className="flex items-center gap-4 mt-2">
              {passedLevel && (
                <Button size="lg" onClick={handleNextLevel}>
                  Next Level
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              )}
               {!passedLevel && (
                 <Button size="lg" onClick={handleNextLevel}>
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Try Again
                </Button>
               )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
