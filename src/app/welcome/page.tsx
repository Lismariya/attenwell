
'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function WelcomePage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/home');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="flex flex-col items-center text-center gap-6">
        <Image 
            src="/images/attenwell.jpeg"
            alt="AttenWell Logo" 
            width={96} 
            height={96}
            className="rounded-lg"
        />
        <h1 className="text-4xl font-bold font-headline">Welcome to AttenWell</h1>
        <p className="text-muted-foreground max-w-md">
          Your partner in improving focus, attention, and cognitive skills through fun and engaging games.
        </p>
        <div className="flex flex-col gap-4 w-full max-w-xs mt-4">
          <Button asChild size="lg" className="w-full">
            <Link href="/login">Login</Link>
          </Button>
           <Button asChild size="lg" variant="outline" className="w-full">
            <Link href="/signup">Sign Up</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
