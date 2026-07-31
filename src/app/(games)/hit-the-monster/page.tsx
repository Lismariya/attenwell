
'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
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
import { Play, RefreshCw, Hammer, Trophy, ArrowRight, RotateCcw, PauseIcon, Square, Loader2, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { GhostIcon, RabbitIcon } from '@/components/game-icons';
import Image from 'next/image';
import { games } from '@/lib/games';
import { Hole } from '@/components/Hole';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, increment, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { CoinIcon } from '@/components/catch-game-icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KID_LEVELS_CONFIG, getNextMission, isLevelUnlocked } from '@/lib/levels';
import { useProgression } from '@/hooks/useProgression';
import type { UserProfile } from '@/types/user';


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
    { holes: 2, monsters: 6, friendlies: 2, duration: 3000 }, // Level 1
    { holes: 3, monsters: 8, friendlies: 3, duration: 3000 }, // Level 2
    { holes: 3, monsters: 10, friendlies: 3, duration: 2500 }, // Level 3 (time up)
    { holes: 4, monsters: 12, friendlies: 4, duration: 2500 }, // Level 4
    { holes: 4, monsters: 15, friendlies: 4, duration: 2000 }, // Level 5 (time up)
];

const STORAGE_KEY_GAME_HISTORY = 'game_history';


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
        "relative w-24 h-24 flex items-center justify-center",
        character ? 'cursor-pointer' : 'cursor-default'
      )}
      onClick={onClick}
    >
      <Hole className="w-full h-auto" />
      {character && (
        <div className="absolute inset-0 flex justify-center" style={{ top: '0%'}}>
            <character.Icon className={cn("w-16 h-16 animate-in zoom-in-95 slide-in-from-bottom-5", character.type === 'friendly' ? 'text-pink-400' : 'text-green-300')} />
        </div>
      )}
    </div>
  );
}


export default function HitTheMonsterPage() {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused' | 'finished'>('idle');
  const [coins, setCoins] = useState(0);
  const [level, setLevel] = useState(1);
  const [monstersHit, setMonstersHit] = useState(0);
  const [friendliesHit, setFriendliesHit] = useState(0);
  const [holes, setHoles] = useState<HoleState[]>([]);
  const [scoreFeedbacks, setScoreFeedbacks] = useState<ScoreFeedback[]>([]);
  const [nextGameSuggestion, setNextGameSuggestion] = useState<string | null>(null);
  const [playableLevel, setPlayableLevel] = useState<number | null>(null);
  
  const charactersToPop = useRef<CharacterType[]>([]);
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  
  const gameInfo = games.find(g => g.href.includes('hit-the-monster'));
  const { toast } = useToast();
  const { checkAndAdvanceKidLevel } = useProgression();
  
  const config = levelConfig[level - 1] || levelConfig[levelConfig.length - 1];
  const passedLevel = monstersHit >= config.monsters && friendliesHit === 0;

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


  useEffect(() => {
    if (typeof window !== 'undefined') {
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

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if(gameLoopRef.current) {
        clearTimeout(gameLoopRef.current);
        gameLoopRef.current = null;
    }
  }, []);

  const handleEndGame = useCallback(async () => {
    if (gameState !== 'playing') return;
    
    setGameState('finished');
    clearAllTimers();
    
    if (passedLevel) {
        playSound('levelComplete');
        await updateProgress();
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
  }, [clearAllTimers, gameState, playSound, passedLevel, updateProgress, userProfile, gameInfo, saveGameHistory]);


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
    if (gameState === 'playing' && playableLevel) {
      scheduleNextPop();
    } else {
      clearAllTimers();
    }
    return () => clearAllTimers();
  }, [gameState, scheduleNextPop, clearAllTimers, playableLevel]);

  const handleStartGame = () => {
    if (playableLevel === null) return;
    startGameForLevel(playableLevel);
  };
  
  const startGameForLevel = (levelToStart: number) => {
    setLevel(levelToStart);

    const currentConfig = levelConfig[levelToStart - 1] || levelConfig[levelConfig.length - 1];
    setGameState('playing');
    setCoins(0);
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
    setGameState('idle');
  };

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
        setCoins(prev => prev + 10);
        setMonstersHit(prev => prev + 1);
        playSound('monsterHit');
        showScoreFeedback(10, index);
    } else if (clickedHole.character?.type === 'friendly') {
        setFriendliesHit(prev => prev + 1);
        setCoins(prev => Math.max(0, prev - 20));
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
      <CardHeader className="text-center">
        <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit mb-2">
          <Hammer className="h-8 w-8" />
        </div>
        <CardTitle className="text-2xl font-headline">Hit the Monster</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-6 p-2 min-h-[500px]">
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


                <div className="flex flex-col items-center justify-center gap-4 mt-6">
                    <Button size="lg" onClick={handleStartGame} disabled={isUserLoading || isProfileLoading || playableLevel === null}>
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

        {(gameState === 'playing' || gameState === 'paused') && (
          <>
            <div className="flex justify-between w-full text-lg font-semibold px-4">
              <span>Level: {level}</span>
               <div className="flex items-center gap-1">
                  <CoinIcon className="w-6 h-6" />
                  <span>{coins}</span>
              </div>
            </div>
             <div className="flex justify-between w-full text-lg font-semibold px-4">
                <span>Monsters Hit: {monstersHit} / {config.monsters}</span>
                <span>Rabbits Hit: {friendliesHit}</span>
            </div>
            <div className="relative w-full aspect-square max-w-md bg-[#a2d168] rounded-lg p-4">
              <div className={cn("grid gap-x-2 gap-y-4 justify-items-center", gridClass(config.holes))}>
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
                      <h2 className="text-4xl font-bold text-white animate-pulse">PAUSED</h2>
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
            <h3 className="text-xl font-headline">Level {passedLevel ? 'Complete!' : 'Failed'}</h3>
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
            
            <p className="text-2xl mt-4">Coins Earned: <span className='font-bold text-primary'>{coins}</span></p>
            
            {passedLevel ? (
                <p className='text-yellow-500 font-bold'>You passed the level!</p>
            ) : (
              <p className='text-red-500 font-bold'>You need to hit {config.monsters} monsters and 0 rabbits to pass.</p>
            )}
            
            <div className='flex gap-4 mt-4'>
                <Button size="lg" onClick={handleNextLevel}>
                    {passedLevel ? 'Continue' : 'Try Again'}
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

    

    

    