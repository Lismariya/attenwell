
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
import { Play, Eye, Trophy, RefreshCw, RotateCcw, Loader2, ArrowRight, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { games } from '@/lib/games';
import { cn } from '@/lib/utils';
import { BallIcon } from '@/components/BallIcon';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, increment, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { CoinIcon } from '@/components/catch-game-icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KID_LEVELS_CONFIG, getNextMission, isLevelUnlocked } from '@/lib/levels';
import { useProgression } from '@/hooks/useProgression';
import type { UserProfile } from '@/types/user';


const COLLISION_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/collission.mp3?alt=media&token=ade6c6ef-0eb9-4f69-a9d4-5d2e383a1d6f';
const RIGHT_SELECTION_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/right.mp3?alt=media&token=fcf2236d-dcd2-480f-993d-faca1a85b20a';
const WRONG_SELECTION_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/ooh-4-82986.mp3?alt=media&token=048c3cdf-5bef-4546-8b8e-3fbe26021204';
const STORAGE_KEY_GAME_HISTORY = 'game_history';


type Ball = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isTarget: boolean;
  isTargetVisible: boolean;
  rotation: number;
  size: number;
};

type GamePhase = 'idle' | 'starting' | 'memorize' | 'moving' | 'selecting' | 'result' | 'levelComplete' | 'finished';

type ScoreFeedback = {
  key: number;
  value: string;
  x: number;
  y: number;
  color: string;
};

const levelConfig = [
    { balls: 2, speed: 1 }, // Level 1: 2 balls, slow
    { balls: 3, speed: 1 }, // Level 2: 3 balls, slow
    { balls: 3, speed: 2 }, // Level 3: 3 balls, fast
    { balls: 4, speed: 1 }, // Level 4: 4 balls, slow
    { balls: 4, speed: 1.5 },// Level 5: 4 balls, medium
    { balls: 4, speed: 2 }, // Level 6: 4 balls, high
];


export default function TrackTheBallPage() {
  const [gameState, setGameState] = useState<GamePhase>('idle');
  const [level, setLevel] = useState(1);
  const [coins, setCoins] = useState(0);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [scoreFeedback, setScoreFeedback] = useState<ScoreFeedback | null>(null);
  const [nextGameSuggestion, setNextGameSuggestion] = useState<string | null>(null);
  const [playableLevel, setPlayableLevel] = useState<number | null>(null);
  
  const gameInfo = games.find(g => g.href.includes('track-the-ball'));
  const animationFrameRef = useRef<number>();
  const gameFlowTimeoutRef = useRef<NodeJS.Timeout>();
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

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

  const animationDuration = 5000;
  
  const config = levelConfig[level - 1] || levelConfig[levelConfig.length - 1];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRefs.current = {
        collision: new Audio(COLLISION_SOUND_URL),
        right: new Audio(RIGHT_SELECTION_SOUND_URL),
        wrong: new Audio(WRONG_SELECTION_SOUND_URL),
      };
      Object.values(audioRefs.current).forEach(audio => {
        audio.load();
      });

    }
     return () => {
      Object.values(audioRefs.current).forEach(audio => {
        if (audio && !audio.paused) {
            audio.pause();
        }
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

  const showScoreFeedback = (value: number, ball: Ball) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    const isPositive = value > 0;
    setScoreFeedback({ 
        key: Date.now(), 
        value: isPositive ? `+${value}`: `${value}`, 
        x: ball.x, 
        y: ball.y,
        color: isPositive ? 'text-green-500' : 'text-red-500',
    });
    feedbackTimeoutRef.current = setTimeout(() => {
      setScoreFeedback(null);
    }, 1500);
  };
  
 const animateBalls = useCallback(() => {
    if (!gameAreaRef.current) return;
    const gameAreaSize = gameAreaRef.current.offsetWidth;
    const speed = config.speed;
    
    setBalls(prevBalls => {
        let newBalls = prevBalls.map(ball => ({ ...ball, rotation: (ball.rotation + 0.5 * speed) % 360 }));

        // Update positions
        newBalls.forEach(ball => {
            ball.x += ball.vx;
            ball.y += ball.vy;

            // Wall collision
            if (ball.x <= 0 || ball.x >= gameAreaSize - ball.size) {
                ball.vx *= -1;
                ball.x = Math.max(0, Math.min(ball.x, gameAreaSize - ball.size));
                playSound('collision');
            }
            if (ball.y <= 0 || ball.y >= gameAreaSize - ball.size) {
                ball.vy *= -1;
                ball.y = Math.max(0, Math.min(ball.y, gameAreaSize - ball.size));
                playSound('collision');
            }
        });

        // Ball-to-ball collision
        for (let i = 0; i < newBalls.length; i++) {
            for (let j = i + 1; j < newBalls.length; j++) {
                const ball1 = newBalls[i];
                const ball2 = newBalls[j];
                const dx = ball2.x - ball1.x;
                const dy = ball2.y - ball1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < ball1.size) {
                    playSound('collision');
                    // Collision detected, resolve it
                    const angle = Math.atan2(dy, dx);
                    const sin = Math.sin(angle);
                    const cos = Math.cos(angle);

                    // Rotate ball1's position
                    const pos1 = { x: 0, y: 0 };
                    // Rotate ball2's position
                    const pos2 = { x: dx * cos + dy * sin, y: dy * cos - dx * sin };
                    // Rotate ball1's velocity
                    const vel1 = { x: ball1.vx * cos + ball1.vy * sin, y: ball1.vy * cos - ball1.vx * sin };
                    // Rotate ball2's velocity
                    const vel2 = { x: ball2.vx * cos + ball2.vy * sin, y: ball2.vy * cos - ball2.vx * sin };

                    // Collision reaction
                    const vxTotal = vel1.x - vel2.x;
                    vel1.x = ((1 - 1) * vel1.x + 2 * 1 * vel2.x) / (1 + 1);
                    vel2.x = vxTotal + vel1.x;

                    // Update positions to avoid overlap
                    const absV = Math.abs(vel1.x) + Math.abs(vel2.x);
                    const overlap = ball1.size - Math.abs(pos1.x - pos2.x);
                    pos1.x += vel1.x / absV * overlap;
                    pos2.x += vel2.x / absV * overlap;

                    // Rotate positions back
                    const pos1Final = { x: pos1.x * cos - pos1.y * sin, y: pos1.y * cos + pos1.x * sin };
                    const pos2Final = { x: pos2.x * cos - pos2.y * sin, y: pos2.y * cos + pos2.x * sin };
                    
                    ball2.x = ball1.x + pos2Final.x;
                    ball2.y = ball1.y + pos2Final.y;
                    ball1.x = ball1.x + pos1Final.x;

                    // Rotate velocities back
                    ball1.vx = vel1.x * cos - vel1.y * sin;
                    ball1.vy = vel1.y * cos + vel1.x * sin;
                    ball2.vx = vel2.x * cos - vel2.y * sin;
                    ball2.vy = vel2.y * cos + vel2.x * sin;
                }
            }
        }
        return newBalls;
    });

    animationFrameRef.current = requestAnimationFrame(animateBalls);
}, [config, playSound]);

    const updateProgress = useCallback(async () => {
        if (!userDocRef || !gameInfo || !firestore) return;

        const coinsEarned = Math.round(level * config.speed * 5);
        setCoins(prev => prev + coinsEarned);
        
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
    }, [userDocRef, firestore, gameInfo, level, config, toast, checkAndAdvanceKidLevel]);


  const startRound = useCallback((currentLevel: number) => {
    if (!gameAreaRef.current || gameAreaRef.current.offsetWidth === 0) return;
    const gameAreaSize = gameAreaRef.current.offsetWidth;
    const ballSize = gameAreaSize * 0.125; // 12.5% of game area width

    setScoreFeedback(null);
    
    const currentConfig = levelConfig[currentLevel - 1] || levelConfig[levelConfig.length - 1];
    const currentNumBalls = currentConfig.balls;
    const currentSpeed = currentConfig.speed;
    
    const newBalls: Omit<Ball, 'vx' | 'vy' | 'rotation'>[] = [];
    const targetIndex = Math.floor(Math.random() * currentNumBalls);

    while (newBalls.length < currentNumBalls) {
        const x = Math.random() * (gameAreaSize - ballSize);
        const y = Math.random() * (gameAreaSize - ballSize);
        let overlapping = false;
        for (const ball of newBalls) {
            const dist = Math.hypot(ball.x - x, ball.y - y);
            if (dist < ballSize) {
                overlapping = true;
                break;
            }
        }
        if (!overlapping) {
             newBalls.push({
                id: newBalls.length,
                x,
                y,
                isTarget: newBalls.length === targetIndex,
                isTargetVisible: false,
                size: ballSize,
            })
        }
    }

    const ballsWithVelocity = newBalls.map(b => {
        const angle = Math.random() * 2 * Math.PI;
        return {
            ...b,
            vx: Math.cos(angle) * currentSpeed,
            vy: Math.sin(angle) * currentSpeed,
            rotation: 0,
        }
    });
    
    setBalls(ballsWithVelocity);
    setGameState('memorize');

    // Wait 1s, then show highlight
    gameFlowTimeoutRef.current = setTimeout(() => {
        setBalls(prev => prev.map(b => b.isTarget ? {...b, isTargetVisible: true} : b));
        
        // Wait 2s for memorize, then start moving
        gameFlowTimeoutRef.current = setTimeout(() => {
            setBalls(prev => prev.map(b => ({...b, isTargetVisible: false})));
            setGameState('moving');
            animationFrameRef.current = requestAnimationFrame(animateBalls);
            
            // Stop animation after duration
            gameFlowTimeoutRef.current = setTimeout(() => {
                if(animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
                setGameState('selecting');
            }, animationDuration);

        }, 2000);
    }, 1000);
  }, [animateBalls, animationDuration]);

  useEffect(() => {
    if (gameState === 'starting' && gameAreaRef.current && gameAreaRef.current.offsetWidth > 0 && playableLevel) {
        setLevel(playableLevel);
        startRound(playableLevel);
    }
  }, [gameState, playableLevel, startRound]);

  useEffect(() => {
    return () => {
        if(animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if(gameFlowTimeoutRef.current) {
            clearTimeout(gameFlowTimeoutRef.current);
        }
        if(feedbackTimeoutRef.current) {
            clearTimeout(feedbackTimeoutRef.current);
        }
    }
  }, []);

  const handleStartGame = () => {
    setCoins(0);
    setGameState('starting');
  };
  
  const handleBallClick = async (ball: Ball) => {
    if (gameState !== 'selecting') return;

    setGameState('result');
    if (ball.isTarget) {
      playSound('right');
      await updateProgress();
      saveGameHistory('Passed');
      
      const nextMission = getNextMission(userProfile, gameInfo?.title || "");
        if (!nextMission) {
            setNextGameSuggestion("all complete");
        } else if (typeof nextMission === 'string') {
            setNextGameSuggestion(nextMission);
        }
      setGameState('levelComplete');

    } else {
       playSound('wrong');
       const wrongPoints = -5;
       showScoreFeedback(wrongPoints, ball);
       setCoins(prev => Math.max(0, prev + wrongPoints));
       const correctBall = balls.find(b => b.isTarget);
       if(correctBall) {
           setBalls(prev => prev.map(b => b.isTarget ? {...b, isTargetVisible: true} : b))
       }
       saveGameHistory('Failed');
       
       gameFlowTimeoutRef.current = setTimeout(() => setGameState('finished'), 2000);
    }
  }

  const handlePlayAgain = () => {
    setGameState('idle');
    setCoins(0);
  }

  const handleNextLevel = () => {
    setGameState('idle');
  }
  
  let instructionText = '';
  if (gameState === 'memorize' && balls.some(b => b.isTargetVisible)) {
    instructionText = "Memorize the highlighted ball.";
  } else if (gameState === 'moving') {
    instructionText = "Track the ball!";
  } else if (gameState === 'selecting') {
    instructionText = "Which ball was it?";
  }

  const isLoading = isUserLoading || isProfileLoading;


  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit mb-2">
          <Eye className="h-6 w-6 md:h-8 md:w-8" />
        </div>
        <CardTitle className="text-2xl md:text-3xl font-headline">Track the Ball</CardTitle>
        <CardDescription>
          Follow the highlighted ball and find it after it stops.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-4 p-4 md:p-6 min-h-[550px]">
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

        {gameState === 'finished' && (
            <div className="text-center flex flex-col items-center gap-4">
                <h3 className="text-xl md:text-2xl font-headline">Game Over!</h3>
                <p className="text-lg md:text-xl text-muted-foreground">Your final coins:</p>
                <p className="text-3xl md:text-4xl font-bold text-primary">{coins}</p>
                <p className="text-muted-foreground">You reached level {level}.</p>
                <Button size="lg" onClick={handlePlayAgain}>
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Play Again
                </Button>
            </div>
        )}

        {gameState === 'levelComplete' && (
            <div className="text-center flex flex-col items-center gap-4">
                <h3 className="text-xl md:text-2xl font-headline">Level {level} Complete!</h3>
                <p className="text-lg md:text-xl text-muted-foreground">Total Coins:</p>
                <p className="text-3xl md:text-4xl font-bold text-primary">{coins}</p>
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
                    Continue <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
            </div>
        )}
        
        <div
          ref={gameAreaRef}
          className={cn(
            "relative w-full aspect-square bg-muted rounded-lg overflow-hidden",
            (gameState === 'idle' || gameState === 'finished' || gameState === 'levelComplete') && "hidden"
          )}
        >
          {balls.map(ball => (
            <div
              key={ball.id}
              onClick={() => handleBallClick(ball)}
              className={cn(
                "absolute",
                (gameState === 'selecting') && 'cursor-pointer'
              )}
              style={{
                width: ball.size,
                height: ball.size,
                left: ball.x,
                top: ball.y,
                transition: 'none',
                transform: `rotate(${ball.rotation}deg)`,
              }}
            >
              <BallIcon className="w-full h-full" />
                {ball.isTargetVisible && (
                <div className="absolute inset-[-10px] rounded-full animate-pulse-deep">
                    <div className="w-full h-full rounded-full border-4 border-yellow-300/80" style={{
                        boxShadow: '0 0 20px 5px rgba(253, 224, 71, 0.6)',
                    }} />
                </div>
                )}
            </div>
          ))}
            {scoreFeedback && (
            <div
                key={scoreFeedback.key}
                className={cn(
                'absolute pointer-events-none text-3xl font-bold animate-out fade-out-0 duration-1000',
                scoreFeedback.color,
                'transition-all ease-out'
                )}
                style={{
                left: scoreFeedback.x + (balls[0]?.size / 4 || 0),
                top: scoreFeedback.y - (balls[0]?.size / 2 || 0),
                transform: 'translateY(-20px)',
                }}
            >
                {scoreFeedback.value}
            </div>
            )}
        </div>
        {(gameState !== 'idle' && gameState !== 'finished' && gameState !== 'levelComplete') && (
            <>
                <div className="w-full flex justify-between text-lg font-semibold px-2">
                    <span>Level: {level}</span>
                     <div className="flex items-center gap-1">
                        <CoinIcon className="w-6 h-6" />
                        <span>{coins}</span>
                    </div>
                </div>
                <div className="h-8 flex items-center justify-center w-full">
                    <p className="text-lg md:text-xl font-headline text-primary text-center">
                        {instructionText}
                    </p>
                </div>
            </>
        )}
      </CardContent>
    </Card>
  );
}

    

    