
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
  Trophy,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { games } from '@/lib/games';

const FLIP_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/card-sounds-35956.mp3?alt=media&token=c135cab6-55a4-4297-bd14-3d57c66f7b0f';
const MATCH_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/man-says-amazing-184036.mp3?alt=media&token=d35f458f-5eaf-4279-b2f8-6c0fc873effb';
const COMPLETE_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/crowd-cheering-383111.mp3?alt=media&token=ebc76a39-6400-4b39-ac6a-f7d437f07744';

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
    { pairs: 2 }, // Level 1: 4 cards
    { pairs: 3 }, // Level 2: 6 cards
    { pairs: 3 }, // Level 3: 6 cards
    { pairs: 4 }, // Level 4: 8 cards
    { pairs: 4 }, // Level 5: 8 cards
    { pairs: 6 }, // Level 6: 12 cards
    { pairs: 6 }, // Level 7: 12 cards
    { pairs: 8 }, // Level 8: 16 cards
    { pairs: 8 }, // Level 9: 16 cards
    { pairs: 8 }, // Level 10: 16 cards
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

const STORAGE_KEY_HIGH_LEVEL = 'memoryMatch_highLevel';
const STORAGE_KEY_LAST_PLAYS = 'memoryMatch_lastPlays';

export default function MemoryMatchPage() {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'finished'>('idle');
  const [cards, setCards] = useState<CardInfo[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [level, setLevel] = useState(1);
  const [highLevel, setHighLevel] = useState(1); 
  const [lastPlays, setLastPlays] = useState<{ moves: number; level: number }[]>([]);
  
  const gameInfo = games.find(g => g.href.includes('memory-match'));
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

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

  const handleEndGame = useCallback(() => {
    setGameState('finished');
    playSound('complete');
    
    if (level >= highLevel) {
      const newHighLevel = level + 1;
      setHighLevel(newHighLevel);
      localStorage.setItem(STORAGE_KEY_HIGH_LEVEL, newHighLevel.toString());
    }

    const newLastPlays = [{ moves, level }, ...lastPlays].slice(0, 5);
    setLastPlays(newLastPlays);
    localStorage.setItem(STORAGE_KEY_LAST_PLAYS, JSON.stringify(newLastPlays));
  }, [moves, level, highLevel, lastPlays]);
  
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

  const startGame = () => {
    setLevel(highLevel);
    setGameState('playing');
    setCards(generateCards(highLevel));
    setMoves(0);
    setFlippedCards([]);
  };

  const handleNextLevel = () => {
    const nextLevel = level + 1;
    setLevel(nextLevel);
    setGameState('playing');
    setCards(generateCards(nextLevel));
    setMoves(0);
    setFlippedCards([]);
  };

  const handleReset = () => {
      setHighLevel(1);
      setLevel(1);
      setLastPlays([]);
      localStorage.removeItem(STORAGE_KEY_HIGH_LEVEL);
      localStorage.removeItem(STORAGE_KEY_LAST_PLAYS);
  }

  const gridClass = (cardCount: number) => {
    if (cardCount <= 4) return 'grid-cols-2';
    if (cardCount <= 6) return 'grid-cols-3';
    if (cardCount <= 12) return 'grid-cols-4';
    return 'grid-cols-4';
  }

  return (
    <Card className="w-full max-w-lg mx-auto">
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
              <div className="flex items-center gap-4 text-xl font-semibold bg-muted p-2 px-4 rounded-full">
                  <Trophy className="w-6 h-6 text-yellow-400" />
                  <span>Highest Level: {highLevel}</span>
              </div>

              {lastPlays.length > 0 && (
                  <div className="mt-4 w-full max-w-xs">
                      <h3 className="font-semibold text-lg">Last Scores</h3>
                      <ul className="mt-2 space-y-1 text-base">
                          {lastPlays.map((play, index) => (
                              <li key={index} className="flex justify-between items-center bg-muted/50 p-2 rounded-md">
                                  <span>Play {index + 1}</span>
                                  <span className="font-bold">{play.moves} moves</span>
                              </li>
                          ))}
                      </ul>
                  </div>
              )}
               <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
                    <Button size="lg" onClick={startGame}>
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
                                <AlertDialogAction onClick={handleReset}>Confirm</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
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
             <Button size="lg" onClick={startGame} variant="outline">
                <RefreshCw className="mr-2 h-5 w-5" />
                Restart
            </Button>
          </div>
        )}

        {gameState === 'finished' && (
          <div className="text-center flex flex-col items-center gap-4 p-4 bg-card rounded-lg shadow-sm w-full">
            <h3 className="text-xl md:text-2xl font-headline">Level Complete!</h3>
            <p className="text-lg md:text-xl text-muted-foreground">Total moves: {moves}</p>
            {level + 1 > highLevel && <p className="text-yellow-400 font-bold">New Highest Level!</p>}
            <div className='flex gap-4 mt-4'>
                <Button size="lg" onClick={handleNextLevel}>
                    Next Level
                    <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => {
                    setGameState('playing');
                    setCards(generateCards(level));
                    setMoves(0);
                    setFlippedCards([]);
                }}>
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Try Again
                </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
