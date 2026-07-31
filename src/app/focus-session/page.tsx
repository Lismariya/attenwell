'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, ArrowLeft, Info, History, Activity } from 'lucide-react';
import { Header } from '@/components/header';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Image from 'next/image';


const STORAGE_KEY_STUDY_TIME = 'focusSession_studyTime';
const STORAGE_KEY_RELAX_TIME = 'focusSession_relaxTime';
const STORAGE_KEY_FOCUS_HISTORY = 'focusSession_history';


export default function FocusSessionSetupPage() {
  const [cycles, setCycles] = useState(2);
  const [studyTime, setStudyTime] = useState(25);
  const [relaxTime, setRelaxTime] = useState(5);
  const [history, setHistory] = useState<any[]>([]);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const defaultHistory = [
      { id: 1, name: 'Focus Session', status: 'Completed (45 min)', timestamp: new Date(new Date().setDate(new Date().getDate() - 2)) },
      { id: 2, name: 'Focus Session', status: 'Terminated (15 min)', timestamp: new Date(new Date().setDate(new Date().getDate() - 4)) },
    ];
    if (typeof window !== 'undefined') {
      const storedStudyTime = localStorage.getItem(STORAGE_KEY_STUDY_TIME);
      const storedRelaxTime = localStorage.getItem(STORAGE_KEY_RELAX_TIME);
      const storedHistory = localStorage.getItem(STORAGE_KEY_FOCUS_HISTORY);
      if (storedStudyTime) {
        setStudyTime(parseInt(storedStudyTime, 10));
      }
      if (storedRelaxTime) {
        setRelaxTime(parseInt(storedRelaxTime, 10));
      }
      if (storedHistory) {
        // Parse dates correctly
        const parsedHistory = JSON.parse(storedHistory).map((item: any) => ({...item, timestamp: new Date(item.timestamp)}));
        setHistory(parsedHistory);
      } else {
        setHistory(defaultHistory);
      }
    }
  }, []);

  const totalSessionTime = cycles > 0 ? (studyTime * cycles) + Math.max(0, relaxTime * (cycles - 1)) : 0;

  const handleStart = () => {
    if (cycles <= 0) {
        toast({
            variant: 'destructive',
            title: 'Invalid Cycles',
            description: `Please enter at least 1 cycle.`,
        });
        return;
    }
    router.push(`/focus-session/progress?study=${studyTime}&relax=${relaxTime}&rounds=${cycles}`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto p-4 md:p-8">
        <div className="grid gap-8 lg:grid-cols-2">
            <Card className="w-full mx-auto">
              <CardHeader className="text-center">
                 <Image
                    src="https://i.postimg.cc/v8KXqg2Q/focus.jpg"
                    alt="Focus Session"
                    width={150}
                    height={150}
                    className="rounded-full border-4 border-white shadow-lg mx-auto"
                  />
                <CardTitle className="text-2xl md:text-3xl font-headline mt-4">Focus Session</CardTitle>
                <CardDescription>How many focus cycles would you like to do?</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center justify-center gap-1 p-4 bg-muted rounded-lg w-full">
                    <Label htmlFor="total-cycles" className="text-sm text-muted-foreground">Focus Cycles</Label>
                     <Input
                      id="total-cycles"
                      type="number"
                      min={1}
                      step={1}
                      value={cycles}
                      onChange={(e) => setCycles(Number(e.target.value))}
                      className="w-24 text-center text-3xl font-bold h-16 border-none bg-transparent shadow-none p-0 focus-visible:ring-0"
                    />
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1 p-4 bg-muted rounded-lg text-center w-full">
                      <p className="text-sm text-muted-foreground">Total Time</p>
                      <p className="text-3xl font-bold text-primary">{totalSessionTime} min</p>
                  </div>
                </div>

                 <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>How it works</AlertTitle>
                    <AlertDescription>
                        Each cycle is one study period ({studyTime} min) and one relax break ({relaxTime} min). The session ends after your last study period.
                    </AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter>
                <Button size="lg" className="w-full" onClick={handleStart} disabled={cycles <= 0}>
                  <Play className="mr-2 h-5 w-5" />
                  Start Session
                </Button>
              </CardFooter>
            </Card>

             <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                    <History className="w-8 h-8 text-primary"/>
                    <CardTitle className="font-headline text-xl">Session History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                   {history.length > 0 ? (
                        history.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-sm p-2 rounded-md bg-muted/50">
                                <div>
                                    <p className="font-semibold">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{format(item.timestamp, "PPP p")}</p>
                                </div>
                                <p className={cn("font-medium", item.status.includes('Terminated') ? 'text-destructive' : 'text-primary')}>{item.status}</p>
                            </div>
                        ))
                   ) : (
                       <p className="text-center text-muted-foreground py-4">No session history yet.</p>
                   )}
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}
