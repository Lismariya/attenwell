
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
import { Ear, Play, RefreshCw, XCircle, CheckCircle, Trophy, Dog, Cat, Bell, ArrowRight, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { games } from '@/lib/games';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, increment, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { CoinIcon } from '@/components/catch-game-icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KID_LEVELS_CONFIG, getNextMission, isLevelUnlocked } from '@/lib/levels';
import { useProgression } from '@/hooks/useProgression';
import type { UserProfile } from '@/types/user';


const PARK_AMBIENCE_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/park.mp3?alt=media&token=79b99e6b-0e2f-40e8-a6cb-cc2ec49ee5cb';
const STORAGE_KEY_GAME_HISTORY = 'game_history';

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

const levelConfig: { targets: TargetSound[]; soundPlays: number; delayMultiplier?: number }[] = [
    { targets: ['dog'], soundPlays: 1 },                      // Level 1
    { targets: ['cat'], soundPlays: 1 },                      // Level 2
    { targets: ['dog', 'cat'], soundPlays: 2 },               // Level 3
    { targets: ['dog', 'chimes'], soundPlays: 2 },            // Level 4
    { targets: ['cat', 'chimes'], soundPlays: 2, delayMultiplier: 1.5 }, // Level 5
    { targets: ['dog', 'cat'], soundPlays: 2, delayMultiplier: 1.5 },   // Level 6
    { targets: ['dog', 'cat', 'chimes'], soundPlays: 3 },      // Level 7
    { targets: ['dog', 'cat', 'chimes'], soundPlays: 3, delayMultiplier: 1.5 }, // Level 8
    { targets: ['dog', 'cat', 'chimes'], soundPlays: 3, delayMultiplier: 1.5 }, // Level 9
    { targets: ['dog', 'cat', 'chimes'], soundPlays: 3, delayMultiplier: 1.5 }, // Level 10
];


export default function NoiseNinjasPage() {
  const [gameState, setGameState] = useState<
    'idle' | 'instructions' | 'playing' | 'ending' | 'finished'
  >('idle');
  
  const [level, setLevel] = useState(1);

  const [correctTaps, setCorrectTaps] = useState(0);
  const [missedTaps, setMissedTaps] = useState(0);
  const [falseTaps, setFalseTaps] = useState(0);
  const [feedback, setFeedback] = useState<'hit' | 'miss' | null>(null);
  const [nextGameSuggestion, setNextGameSuggestion] = useState<string | null>(null);
  const [playableLevel, setPlayableLevel] = useState<number | null>(null);

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const soundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const canClickRef = useRef(false);
  const soundPlayCountRef = useRef(0);
  
  const audioRefs = useRef<{
    ambience?: HTMLAudioElement;
    target?: HTMLAudioElement;
  }>({});
  
  const gameInfo = games.find(g => g.href.includes('noise-ninjas'));
  
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


  const maxSoundPlays = (levelConfig[level - 1] || levelConfig[levelConfig.length - 1]).soundPlays;
  const passedLevel = maxSoundPlays > 0 && correctTaps / maxSoundPlays >= 0.6;
  const coinsEarned = Math.max(0, correctTaps * 10 - (missedTaps + falseTaps) * 5);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
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

  const updateProgress = useCallback(async (currentCoins: number) => {
    if (!userDocRef || !gameInfo || !firestore) return;

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

        // Construct the nested object update
        const newLevelProgress = {
            ...freshUserProfile.levelProgress,
            [kidLevelKey]: {
                ...(freshUserProfile.levelProgress?.[kidLevelKey] || {}),
                [missionKey]: true,
            },
        };

        const newGameProgress = {
            ...freshUserProfile.gameProgress,
            [gameKey]: Math.max(freshUserProfile.gameProgress?.[gameKey] || 0, level),
        };
        
        const updatePayload = {
            levelProgress: newLevelProgress,
            gameProgress: newGameProgress,
            coin: increment(currentCoins),
        };

        transaction.update(userDocRef, updatePayload);
      });

      toast({ title: "Progress Saved!", description: `Level ${level} of ${gameInfo.title} completed.` });
      await checkAndAdvanceKidLevel();

    } catch (error: any) {
      console.error("Progress update transaction failed: ", error);
      toast({ variant: 'destructive', title: 'Error', description: `Failed to save progress: ${error.message}` });
    }
  }, [userDocRef, firestore, gameInfo, level, toast, checkAndAdvanceKidLevel]);


  const handleEndGame = useCallback(() => {
    if (gameState === 'ending' || gameState === 'finished') return;
    setGameState('ending');
    clearAllTimers();
    stopAllSounds();
  }, [gameState, clearAllTimers, stopAllSounds]);

  useEffect(() => {
    const runEndGameLogic = async () => {
      if (gameState === 'ending') {
        const isPassed = maxSoundPlays > 0 && correctTaps / maxSoundPlays >= 0.6;

        if (isPassed) {
          await updateProgress(coinsEarned);
          saveGameHistory('Passed');
          const nextMission = getNextMission(userProfile, gameInfo?.title || "");
          if (!nextMission) {
            setNextGameSuggestion("all complete");
          } else if (typeof nextMission === 'string') {
            setNextGameSuggestion(nextMission);
          }
        } else {
          saveGameHistory('Failed');
        }

        setTimeout(() => {
          if (audioRefs.current.ambience) {
            audioRefs.current.ambience.pause();
            audioRefs.current.ambience.currentTime = 0;
          }
          setGameState('finished');
        }, 500);
      }
    };
    runEndGameLogic();
  }, [gameState, correctTaps, maxSoundPlays, coinsEarned, updateProgress, saveGameHistory, userProfile, gameInfo, setNextGameSuggestion]);

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
    
    const currentLevelConfig = (levelConfig[level-1] || levelConfig[levelConfig.length - 1]);
    const currentTargets = currentLevelConfig.targets;
    const delayMultiplier = currentLevelConfig.delayMultiplier || 1;
    const nextSoundDelay = (Math.random() * 4000 + 3000) * delayMultiplier; // 3-7 seconds

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
    }
    
    return () => {
      if (gameState === 'playing' || gameState === 'ending') {
        clearAllTimers();
      }
    };
  }, [gameState, scheduleNextSound, clearAllTimers]);

  const handleStartGame = () => {
    if(playableLevel === null) return;
    setLevel(playableLevel);
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
    setGameState('idle');
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

  const currentLevelConfig = levelConfig[level - 1] || levelConfig[levelConfig.length - 1];
  const isLoading = isUserLoading || isProfileLoading;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit mb-2">
          <Ear className="h-6 w-6 md:h-8 md:w-8" />
        </div>
        <CardTitle className="text-2xl md:text-3xl font-headline">Noise Ninjas</CardTitle>
        <CardDescription>
          Listen for the target sounds amidst the park noise and click the button!
        </CardDescription>
      </CardHeader>
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
               <p className="text-muted-foreground">Kid Level: {userProfile?.kid_level || 1}</p>
               {playableLevel !== null && <p className="text-lg font-semibold">Next up: Level {playableLevel}</p>}
               
               <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
                <Button size="lg" onClick={handleStartGame} disabled={isLoading || playableLevel === null}>
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
            <div className="flex items-center gap-2 text-lg">
                You earned <CoinIcon className="w-6 h-6" /> <span className="font-bold text-primary">{coinsEarned}</span> coins!
            </div>
             {passedLevel ? (
                <p className='text-accent font-bold'>You passed the level!</p>
             ) : (
                <p className='text-red-500 font-bold'>Try again to unlock the next level.</p>
             )}
            <div className="flex items-center gap-4 mt-2">
                <Button size="lg" onClick={handleNextLevel}>
                  {passedLevel ? 'Continue' : 'Try Again'}
                  {passedLevel ? <ArrowRight className="ml-2 h-5 w-5" /> : <RefreshCw className="mr-2 h-5 w-5" />}
                </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
