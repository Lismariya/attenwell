
'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import type { UserProfile } from '@/types/user';

export function PlayTimeGuard({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const [localSpentSeconds, setLocalSpentSeconds] = useState<number | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const syncTimerRef = useRef<NodeJS.Timeout>();

  // Initialize and handle daily reset
  useEffect(() => {
    if (userProfile && localSpentSeconds === null) {
      const today = format(new Date(), 'yyyy-MM-dd');
      const lastReset = userProfile.playTimeLastResetDate;

      if (lastReset !== today) {
        // Reset for the new day
        setLocalSpentSeconds(0);
        if (userDocRef) {
          updateDoc(userDocRef, {
            playTimeSpentToday: 0,
            playTimeLastResetDate: today
          });
        }
      } else {
        setLocalSpentSeconds(userProfile.playTimeSpentToday || 0);
      }
    }
  }, [userProfile, userDocRef, localSpentSeconds]);

  // Main Ticker
  useEffect(() => {
    if (localSpentSeconds === null || !userProfile) return;

    const limitInSeconds = (userProfile.dailyPlayTimeLimit || 30) * 60;
    
    if (localSpentSeconds >= limitInSeconds) {
      setIsBlocked(true);
      return;
    }

    const interval = setInterval(() => {
      setLocalSpentSeconds(prev => {
        const next = (prev || 0) + 1;
        if (next >= limitInSeconds) {
          setIsBlocked(true);
          clearInterval(interval);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [localSpentSeconds, userProfile]);

  // Periodic Sync to Firestore
  useEffect(() => {
    if (localSpentSeconds === null || !userDocRef) return;

    syncTimerRef.current = setInterval(() => {
      updateDoc(userDocRef, {
        playTimeSpentToday: localSpentSeconds
      });
    }, 30000); // Sync every 30s

    return () => {
        if (syncTimerRef.current) clearInterval(syncTimerRef.current);
        // Final sync on unmount
        updateDoc(userDocRef, {
            playTimeSpentToday: localSpentSeconds
        });
    };
  }, [localSpentSeconds, userDocRef]);

  if (isBlocked) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-4">
        <Card className="w-full max-w-md text-center border-destructive">
          <CardHeader>
            <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit mb-4">
              <ShieldAlert className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-3xl font-headline text-destructive">Time's Up!</CardTitle>
            <CardDescription className="text-lg">
              You've reached your play time limit for today.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total play time today:</p>
                <p className="text-2xl font-bold font-mono">
                    {userProfile?.dailyPlayTimeLimit} minutes
                </p>
            </div>
            <p className="text-muted-foreground">
                Great job today! Go take a break, move around, or read a book. You can play again tomorrow!
            </p>
            <Button asChild className="w-full" size="lg">
                <Link href="/home">Go Back Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
