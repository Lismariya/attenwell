'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Square, Pause } from 'lucide-react';
import { Header } from '@/components/header';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useProgression } from '@/hooks/useProgression';
import type { UserProfile } from '@/types/user';

const MEDITATION_IMAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/meditation.jpg?alt=media&token=72dc1a54-a0bb-4bea-9264-57d6897fa30e';

type PlayerState = 'loading' | 'playing' | 'paused' | 'stopped';

type HistoryEntry = {
  id: number;
  status: 'Completed' | 'Stopped';
  selectedDuration: number;
  actualTime: number;
  timestamp: string;
};

const STORAGE_KEY_MEDITATION_HISTORY = 'meditation_history';

function MeditationPlayer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const duration = searchParams.get('duration');
  const url = searchParams.get('url');
  const { toast } = useToast();

  const { user } = useUser();
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);
  const { checkAndAdvanceKidLevel } = useProgression();

  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedDuration = duration ? parseInt(duration) : 0;

  const saveHistory = useCallback(async (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
    if (typeof window !== 'undefined') {
        const storedHistory = localStorage.getItem(STORAGE_KEY_MEDITATION_HISTORY);
        const history = storedHistory ? JSON.parse(storedHistory) : [];
        const newEntry = {
            ...entry,
            id: Date.now(),
            timestamp: new Date().toISOString(),
        };
        const updatedHistory = [newEntry, ...history].slice(0, 5); // Keep last 5
        localStorage.setItem(STORAGE_KEY_MEDITATION_HISTORY, JSON.stringify(updatedHistory));
    }
    
    if (entry.status === 'Completed' && userDocRef && userProfile) {
        try {
            await updateDoc(userDocRef, {
                'cycleProgress.meditation': true,
            });
            await checkAndAdvanceKidLevel();
        } catch (error) {
             toast({ variant: 'destructive', title: 'Error', description: 'Failed to save meditation progress.' });
        }
    }

  }, [userDocRef, userProfile, toast, checkAndAdvanceKidLevel]);

  const stopAudio = useCallback((status?: 'Stopped') => {
    if (audioRef.current) {
        if(status === 'Stopped' && selectedDuration > 0) {
            saveHistory({
                status: 'Stopped',
                selectedDuration: selectedDuration,
                actualTime: Math.floor(audioRef.current.currentTime),
            });
        }
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
    router.replace('/meditation');
  }, [selectedDuration, saveHistory, router]);

  useEffect(() => {
    if (!duration || !url) {
      router.replace('/meditation');
      return;
    }

    audioRef.current = new Audio(decodeURIComponent(url));
    setTimeLeft(selectedDuration * 60);

    const audio = audioRef.current;

    const handleCanPlay = async () => {
      try {
        await audio.play();
        setPlayerState('playing');
      } catch (error) {
        console.error("Audio play failed on load:", error);
        stopAudio();
      }
    };

    const handleTimeUpdate = () => {
      if (audio.duration > 0) {
        setProgress((audio.currentTime / audio.duration) * 100);
        setTimeLeft(audio.duration - audio.currentTime);
      }
    };

    const handleEnded = () => {
      if (selectedDuration > 0) {
        saveHistory({
          status: 'Completed',
          selectedDuration: selectedDuration,
          actualTime: selectedDuration * 60,
        });
      }
      stopAudio();
    };

    audio.addEventListener('canplaythrough', handleCanPlay);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('canplaythrough', handleCanPlay);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      if (!audio.paused) {
        audio.pause();
      }
    };
  }, [duration, url, router, saveHistory, selectedDuration, stopAudio]);

  const handlePlayPause = async () => {
    if (!audioRef.current) return;

    if (playerState === 'playing') {
      audioRef.current.pause();
      setPlayerState('paused');
    } else if (playerState === 'paused') {
      try {
        await audioRef.current.play();
        setPlayerState('playing');
      } catch (error) {
        console.error("Audio play failed:", error);
        stopAudio();
      }
    }
  };

  const handleStop = () => {
    stopAudio('Stopped');
  };

  const formatSeconds = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!duration || !url) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-8 flex items-center justify-center">
        <div className="grid gap-8 w-full">
          <Card className="w-full max-w-2xl mx-auto">
            <CardContent className="flex flex-col items-center justify-center gap-6 p-4 md:p-12 min-h-[450px]">
              {playerState === 'loading' ? (
                <p>Loading session...</p>
              ) : (
                <>
                  <div className={cn("w-48 h-48 sm:w-64 sm:h-64 rounded-full bg-primary/10 flex items-center justify-center relative overflow-hidden", playerState === 'playing' && 'animate-pulse-zoom')}>
                      <Image
                        src={MEDITATION_IMAGE_URL}
                        alt="Meditation"
                        layout="fill"
                        objectFit="cover"
                      />
                  </div>
                   <div className="text-center">
                    <CardTitle className="text-2xl md:text-3xl font-headline">
                      Meditation Session
                    </CardTitle>
                    <CardDescription>
                      Close your eyes, breathe deeply, and relax.
                    </CardDescription>
                  </div>
                  <div className="w-full max-w-sm flex flex-col items-center gap-4 mt-4">
                    <div className="w-full flex justify-end font-mono text-sm text-muted-foreground">
                      <span>{formatSeconds(timeLeft)}</span>
                    </div>
                    <Progress value={progress} className="w-full" />
                    <div className='flex items-center gap-4'>
                      <Button size="lg" onClick={handlePlayPause}>
                          {playerState === 'playing' ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
                          {playerState === 'playing' ? 'Pause' : 'Play'}
                      </Button>
                      <Button size="lg" onClick={handleStop} variant="destructive">
                          <Square className="mr-2 h-5 w-5" />
                          Stop
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function MeditationPlayerPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
            <MeditationPlayer />
        </Suspense>
    )
}
