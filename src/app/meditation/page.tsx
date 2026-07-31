'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, History, Home } from 'lucide-react';
import { Header } from '@/components/header';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const MEDITATION_IMAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/meditation.jpg?alt=media&token=72dc1a54-a0bb-4bea-9264-57d6897fa30e';

const audioOptions = [
  { duration: 2, url: 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/2min.mp3?alt=media&token=23b9b427-786d-4085-a320-b7d44c68b4ad' },
  { duration: 5, url: 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/5.mp3?alt=media&token=1f981ed7-2498-4084-87c0-c39df072a575' },
  { duration: 10, url: 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/10.mp3?alt=media&token=ae20e8bc-6566-47c2-a055-090df494f7f4' },
  { duration: 15, url: 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/15.mp3?alt=media&token=13d9b2af-227f-420a-ab52-f94c7ab61688' },
  { duration: 20, url: 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/20.mp3?alt=media&token=ab117b61-19d6-4677-8066-e64542df15c7' },
];

type HistoryEntry = {
  id: number;
  status: 'Completed' | 'Stopped';
  selectedDuration: number;
  actualTime: number;
  timestamp: string;
};

const STORAGE_KEY_MEDITATION_HISTORY = 'meditation_history';

export default function MeditationPage() {
  const [selectedDuration, setSelectedDuration] = useState<number>(audioOptions[0].duration);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const storedHistory = localStorage.getItem(STORAGE_KEY_MEDITATION_HISTORY);
        if (storedHistory) {
            setHistory(JSON.parse(storedHistory));
        }
    }
  }, []);

  const handleStartSession = () => {
    const selectedOption = audioOptions.find(opt => opt.duration === selectedDuration);
    if (selectedOption) {
      router.push(`/meditation/player?duration=${selectedOption.duration}&url=${encodeURIComponent(selectedOption.url)}`);
    }
  };

  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return (
     <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-8">
        <div className="grid gap-8">
          <Card className="w-full max-w-2xl mx-auto">
             <CardHeader className="text-center p-4 md:p-6">
                <Image
                  src={MEDITATION_IMAGE_URL}
                  alt="Meditation"
                  width={150}
                  height={150}
                  className="rounded-full border-4 border-white shadow-lg mx-auto"
                />
                <CardTitle className="text-2xl md:text-3xl font-headline">
                  Meditation Session
                </CardTitle>
                <CardDescription>
                  Choose your meditation duration to begin.
                </CardDescription>
              </CardHeader>
            <CardContent className="flex flex-col items-center justify-center gap-6 p-4 md:p-6">
              
              <div className='flex flex-col items-center gap-6 bg-muted p-4 sm:p-6 rounded-lg w-full max-w-md'>
                <h2 className="text-xl font-bold font-headline">Choose Duration</h2>
                <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
                  {audioOptions.map(({ duration }) => (
                    <Button
                      key={duration}
                      variant={selectedDuration === duration ? 'default' : 'outline'}
                      onClick={() => setSelectedDuration(duration)}
                      className="h-auto"
                      size="lg"
                    >
                      <div className="flex flex-col items-center leading-none p-1">
                          <span className="text-xl font-bold">{duration}</span>
                          <span className="text-xs font-light">min</span>
                      </div>
                    </Button>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full max-w-xs">
                    <Button size="lg" onClick={handleStartSession} className="w-full">
                      <Play className="mr-2 h-5 w-5"/>
                      Start Session
                    </Button>
                    <Button asChild size="lg" variant="outline" className="w-full">
                        <Link href="/home">
                            <Home className="mr-2 h-5 w-5" />
                            Main Menu
                        </Link>
                    </Button>
                </div>
              </div>

              {history.length > 0 && (
                  <Card className="w-full mt-8">
                      <CardHeader className="flex flex-row items-center gap-4">
                          <History className="w-8 h-8 text-primary"/>
                          <CardTitle className="font-headline text-xl">Meditation History</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                          {history.map(item => (
                              <div key={item.id} className="flex justify-between items-center text-sm p-2 rounded-md bg-muted/50">
                                  <div>
                                      <p className={cn("font-semibold", item.status === 'Completed' ? 'text-primary' : 'text-destructive')}>{item.status}</p>
                                      <p className="text-xs text-muted-foreground">{format(new Date(item.timestamp), "PPP p")}</p>
                                  </div>
                                  <p className="font-medium text-right">
                                      {formatSeconds(item.actualTime)} / {item.selectedDuration} min
                                  </p>
                              </div>
                          ))}
                      </CardContent>
                  </Card>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
