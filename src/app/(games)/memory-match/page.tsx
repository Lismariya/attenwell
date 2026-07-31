
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
import {
  Puzzle,
  Play,
  RefreshCw,
  Cat,
  Dog,
  Fish,
  Bird,
  Rabbit,
  Turtle,
  Squirrel,
  Bug,
  ArrowRight,
  RotateCcw,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
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


const FLIP_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/card-sounds-35956.mp3?alt=media&token=c135cab6-55a4-4297-bd14-3d57c66f7b0f';
const MATCH_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/man-says-amazing-184036.mp3?alt=media&token=d35f458f-5eaf-4279-b2f8-6c0fc873effb';
const COMPLETE_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/crowd-cheering-383111.mp3?alt=media&token=ebc76a39-6400-4b39-ac6a-f7d437f07744';
const STORAGE_KEY_GAME_HISTORY = 'game_history';

const allIcons = [
  { Icon: Cat, name: 'Cat' },
  { Icon: Dog, name: 'Dog' },
  { Icon: Fish, name: 'Fish' },
  { Icon: Bird, name: 'Bird' },
  { Icon: Rabbit, name: 'Rabbit' },
  { Icon: Turtle, name: 'Turtle' },
  { Icon: Squirrel, name: 'Squirrel' },
  { Icon: Bug, name: 'Bug' },
];

const levelConfig: { pairs: number }[] = [
    { pairs: 2 },  // Level 1: 4 cards
    { pairs: 3 },  // Level 2: 6 cards
    { pairs: 3 },  // Level 3: 6 cards
];

type CardInfo = {
  id: number;
  iconName: string;
  Icon: React.ElementType;
  isFlipped: boolean;
  isMatched: boolean;
};

const generateCards = (level: number): CardInfo[] => {
    const config = levelConfig[level - 1] || levelConfig[levelConfig.length - 1];
    const numPairs = config.pairs;
    
    const iconsForLevel = allIcons.slice(0, numPairs);
    const duplicatedIcons = [...iconsForLevel, ...iconsForLevel];
    const shuffledIcons = duplicatedIcons.sort(() => Math.random() - 0.5);
    return shuffledIcons.map((icon, index) => ({
        id: index,
        iconName: icon.name,
        Icon: icon.Icon,
        isFlipped: false,
        isMatched: false,
    }));
};

export default function MemoryMatchPage() {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'finished'>('idle');
  const [cards, setCards] = useState<CardInfo[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [level, setLevel] = useState(1);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [levelStatus, setLevelStatus] = useState<'passed' | 'failed' | null>(null);
  const [nextGameSuggestion, setNextGameSuggestion] = useState<string | null>(null);
  const [playableLevel, setPlayableLevel] = useState<number | null>(null);
  
  const gameInfo = games.find(g => g.href.includes('memory-match'));
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
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
  

  useEffect(() => {
    if (typeof window !== 'undefined') {
        audioRefs.current = {
            flip: new Audio(FLIP_SOUND_URL),
            match: new Audio(MATCH_SOUND_URL),
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

    const currentConfig = levelConfig[level - 1] || levelConfig[levelConfig.length - 1];
    const coins = Math.max(10, 100 - (moves - currentConfig.pairs) * 10);
    setCoinsEarned(coins);

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
            coin: increment(coins),
        };

        transaction.update(userDocRef, updatePayload);
      });

      toast({ title: "Progress Saved!", description: `Level ${level} of ${gameInfo.title} completed.` });
      await checkAndAdvanceKidLevel();

    } catch (error: any) {
      console.error("Progress update transaction failed: ", error);
      toast({ variant: 'destructive', title: 'Error', description: `Failed to save progress: ${error.message}` });
    }
}, [userDocRef, firestore, gameInfo, level, moves, toast, checkAndAdvanceKidLevel]);


  const handleEndGame = useCallback(async () => {
    const config = levelConfig[level - 1] || levelConfig[levelConfig.length - 1];
    const maxMoves = Math.floor(config.pairs * 1.5) + 1; 
    const passed = moves <= maxMoves;

    if (passed) {
      setLevelStatus('passed');
      playSound('complete');
      await updateProgress();
      saveGameHistory('Passed');
      
      const nextMission = getNextMission(userProfile, gameInfo?.title || "");
      if (!nextMission) {
          setNextGameSuggestion("all complete");
      } else if (typeof nextMission === 'string') {
          setNextGameSuggestion(nextMission);
      }
    } else {
        setLevelStatus('failed');
        saveGameHistory('Failed (Too many moves)');
    }
    setGameState('finished');
  }, [moves, level, playSound, updateProgress, userProfile, gameInfo, saveGameHistory]);
  
  useEffect(() => {
    if (flippedCards.length === 2) {
      const [firstCardIndex, secondCardIndex] = flippedCards;
      const firstCard = cards[firstCardIndex];
      const secondCard = cards[secondCardIndex];

      if (firstCard.iconName === secondCard.iconName) {
        playSound('match');
        setCards(prevCards =>
          prevCards.map(card =>
            card.iconName === firstCard.iconName
              ? { ...card, isMatched: true }
              : card
          )
        );
        setFlippedCards([]);
      } else {
        setTimeout(() => {
          setCards(prevCards =>
            prevCards.map(card =>
              !card.isMatched ? { ...card, isFlipped: false } : card
            )
          );
          setFlippedCards([]);
        }, 1000);
      }
    }
  }, [flippedCards, cards, playSound]);

  useEffect(() => {
    if (gameState === 'playing' && cards.length > 0 && cards.every(card => card.isMatched)) {
      handleEndGame();
    }
  }, [cards, gameState, handleEndGame]);

  const handleCardClick = (index: number) => {
    if (
      gameState !== 'playing' ||
      flippedCards.length === 2 ||
      cards[index].isFlipped
    ) {
      return;
    }
    playSound('flip');

    if (flippedCards.length === 0) {
      setMoves(prev => prev + 1);
    }
    
    setCards(prevCards =>
      prevCards.map((card, i) =>
        i === index ? { ...card, isFlipped: true } : card
      )
    );
    setFlippedCards(prev => [...prev, index]);
  };

  const startGame = (levelToStart: number) => {
    setLevel(levelToStart);
    setGameState('playing');
    setCards(generateCards(levelToStart));
    setMoves(0);
    setFlippedCards([]);
    setLevelStatus(null);
  };

  const handleNextLevel = () => {
    setGameState('idle');
  };

  const gridClass = (cardCount: number) => {
    if (cardCount <= 4) return 'grid-cols-2';
    if (cardCount <= 6) return 'grid-cols-3';
    if (cardCount <= 12) return 'grid-cols-4';
    return 'grid-cols-4';
  }

  const isLoading = isUserLoading || isProfileLoading;
  const config = levelConfig[level - 1] || levelConfig[levelConfig.length - 1];

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit mb-2">
          <Puzzle className="h-6 w-6 md:h-8 md:w-8" />
        </div>
        <CardTitle className="text-2xl md:text-3xl font-headline">Memory Match</CardTitle>
        <CardDescription>
          Flip the cards and find all the matching pairs.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-4 p-4 md:p-6 min-h-[500px]">
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
        
        {gameState === 'playing' && (
          <div className='flex flex-col items-center gap-4 w-full'>
            <div className="w-full flex justify-between text-lg font-semibold px-2">
                <span>Level: {level}</span>
                <span>Moves: {moves}</span>
            </div>
            <div className='relative w-full aspect-square bg-muted rounded-lg overflow-hidden p-2 sm:p-4'>
                <div className={cn("grid gap-2 sm:gap-4 w-full h-full place-content-center", gridClass(cards.length))}>
                {cards.map((card, i) => (
                    <div
                    key={i}
                    className={cn(
                        'aspect-square rounded-lg flex items-center justify-center cursor-pointer transition-all shadow-md',
                        'transform-style-3d',
                        card.isFlipped ? '[transform:rotateY(180deg)]' : ''
                    )}
                    onClick={() => handleCardClick(i)}
                    >
                    <div className="absolute w-full h-full backface-hidden rounded-lg overflow-hidden">
                        <Image
                        src="/images/attenwell.jpeg"
                        alt="Card Back"
                        fill
                        className="object-cover p-1"
                        />
                    </div>
                    <div className="absolute w-full h-full [transform:rotateY(180deg)] backface-hidden bg-card border-2 border-primary rounded-lg flex items-center justify-center">
                        <card.Icon className={cn("w-1/2 h-1/2", card.isMatched ? 'text-accent' : 'text-primary' )} />
                    </div>
                    </div>
                ))}
                </div>
            </div>
             <Button size="lg" onClick={() => playableLevel && startGame(playableLevel)} variant="outline">
                <RefreshCw className="mr-2 h-5 w-5" />
                Restart
            </Button>
          </div>
        )}

        {gameState === 'finished' && (
          <div className="text-center flex flex-col items-center gap-4 p-4 bg-card rounded-lg shadow-sm w-full">
            {levelStatus === 'passed' ? (
                <CheckCircle className="w-16 h-16 text-green-500" />
            ) : (
                <XCircle className="w-16 h-16 text-destructive" />
            )}
            <h3 className="text-xl md:text-2xl font-headline">
              {levelStatus === 'passed' ? 'Level Complete!' : 'Almost There!'}
            </h3>
            <div className="text-lg text-muted-foreground">
                <p>Your moves: <span className='font-bold'>{moves}</span></p>
                <p>Target moves: <span className='font-bold'>&le; {Math.floor(config.pairs * 1.5) + 1}</span></p>
            </div>
            
            {levelStatus === 'passed' ? (
              <>
                <div className="flex items-center gap-2 text-lg">
                    You earned <CoinIcon className="w-6 h-6" /> <span className="font-bold text-primary">{coinsEarned}</span> coins!
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
                    Continue
                    <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </>
            ) : (
               <>
                <p className="text-destructive font-bold">Too many moves. Try this level again to improve your skill!</p>
                <Button size="lg" onClick={() => playableLevel && startGame(playableLevel)}>
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Try Again
                </Button>
               </>
            )}
            <Button size="lg" variant="outline" onClick={() => setGameState('idle')}>
                Main Menu
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

    

    
