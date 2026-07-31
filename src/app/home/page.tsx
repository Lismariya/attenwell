'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Brain, Gamepad2, User, Activity, Loader2, BarChart, Star, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { Header } from '@/components/header';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { CoinIcon } from '@/components/catch-game-icons';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { KID_LEVELS_CONFIG, getNextMission } from '@/lib/levels';
import { games } from '@/lib/games';
import type { Mission } from '@/lib/levels';
import { useProgression } from '@/hooks/useProgression';
import { BunnyAssistant } from '@/components/BunnyAssistant';

type MenuItem = {
    title: string;
    href: string;
    icon: React.ElementType;
    description: string;
    imageUrl?: string;
}

const menuItems: MenuItem[] = [
    {
        title: 'Meditation',
        href: '/meditation',
        icon: Brain,
        description: 'Your daily dose of quiet',
        imageUrl: 'https://i.postimg.cc/W1w33ZQv/meditation.jpg'
    },
    {
        title: 'Focus Session',
        href: '/focus-session',
        icon: Activity,
        description: 'Master your time',
        imageUrl: 'https://i.postimg.cc/v8KXqg2Q/focus.jpg'
    },
    {
        title: 'Games',
        href: '/games',
        icon: Gamepad2,
        description: 'Fun and engaging cognitive challenges.',
        imageUrl: 'https://i.postimg.cc/x8c4qBgv/game.jpg'
    },
    {
        title: 'Dashboard',
        href: '/parents-dashboard',
        icon: User,
        description: 'Track progress and manage settings.',
        imageUrl: 'https://i.postimg.cc/QdsvJYdR/parents.jpg'
    }
]

type NextMissionInfo = {
    name: string;
    description: string;
    href: string;
    icon: React.ElementType;
};

export default function HomePage() {
  const [loadingItem, setLoadingItem] = useState<string | null>(null);
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { checkAndAdvanceKidLevel } = useProgression();

  const userDocRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null
  , [user, firestore]);
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

  const [kidLevelProgress, setKidLevelProgress] = useState(0);
  const [nextMission, setNextMission] = useState<NextMissionInfo | null>(null);
  const [showBunny, setShowBunny] = useState(true);

  useEffect(() => {
    if (userProfile) {
        const currentKidLevel = userProfile.kid_level || 1;
        const missionsForLevel = KID_LEVELS_CONFIG[currentKidLevel]?.filter(m => typeof m !== 'string') as Mission[];

        if (missionsForLevel && missionsForLevel.length > 0) {
            const levelProgressData = userProfile.levelProgress?.[`KidLevel${currentKidLevel}`] || {};
            
            const completedMissions = missionsForLevel.filter(mission => {
                const missionKey = `${mission.game.replace(/\s+/g, '')}-${mission.level}`;
                return levelProgressData[missionKey] === true;
            }).length;

            setKidLevelProgress((completedMissions / missionsForLevel.length) * 100);
        }

        const missionSuggestion = getNextMission(userProfile, ''); 
        
        if (missionSuggestion) {
            const gameInfo = games.find(g => g.title === missionSuggestion.game);
            if(gameInfo) {
                setNextMission({
                    name: `${gameInfo.title} - Level ${missionSuggestion.level}`,
                    description: gameInfo.description,
                    href: gameInfo.href,
                    icon: gameInfo.icon!,
                });
            }
        } else {
            setNextMission(null); 
        }
    }
  }, [userProfile]);


  const handleMenuClick = (href: string) => {
    setLoadingItem(href);
  };
  
  const isLoading = isUserLoading || isProfileLoading;

  const renderDashboard = () => {
    if (isLoading) {
      return (
        <>
            <Card className="w-full max-w-4xl mx-auto mb-4">
                <CardContent className="flex items-center gap-4 p-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </CardContent>
            </Card>
        </>
      );
    }

    if (!userProfile) {
      return (
        <Card className="w-full max-w-4xl mx-auto mb-4">
            <CardContent className="p-4 text-muted-foreground">
                Could not load user profile.
            </CardContent>
        </Card>
      );
    }

    return (
        <>
            <Card className="w-full max-w-4xl mx-auto mb-4">
                <CardContent className="flex items-center gap-4 p-4">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={userProfile.avatarUrl} alt={userProfile.displayName} />
                        <AvatarFallback>{userProfile.displayName?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="grid gap-1">
                        <p className="text-xl font-bold">Welcome, {userProfile.displayName}!</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>Age: <span className="font-semibold text-foreground">{userProfile.age}</span></span>
                             <div className="flex items-center gap-1">
                                <CoinIcon className="w-5 h-5" />
                                <span className="font-semibold text-foreground">{userProfile.coin}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                <span>Kid Level: <span className="font-semibold text-foreground">{userProfile.kid_level}</span></span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </>
    );
  };


  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <Header />
      <main className="flex-1 container mx-auto p-4">
        {renderDashboard()}

        {!isLoading && userProfile && (
            <Card className="w-full max-w-4xl mx-auto mb-4">
                <CardHeader>
                    <CardTitle className="font-headline text-xl">Your Next Adventure!</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {nextMission ? (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-primary/10 rounded-lg">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-primary/20 text-primary hidden sm:block">
                                    <nextMission.icon className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="font-semibold">Next Up: {nextMission.name}</p>
                                    <p className="text-sm text-muted-foreground">{nextMission.description}</p>
                                </div>
                            </div>
                            <Button asChild>
                                <Link href={nextMission.href} onClick={() => setLoadingItem(nextMission.href)}>
                                    Let's Go!
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-4">
                            Amazing work! You've completed all tasks for this level.
                        </p>
                    )}
                    <div className="pt-2">
                        <div className="flex justify-between mb-1 text-sm">
                            <span className="font-medium">Kid Level {userProfile.kid_level || 1} Progress</span>
                            <span className="text-muted-foreground">{kidLevelProgress.toFixed(0)}% Complete</span>
                        </div>
                        <Progress value={kidLevelProgress} className="h-3" />
                    </div>
                    {kidLevelProgress >= 100 && !nextMission && (
                        <div className="pt-4 flex justify-center">
                            <Button onClick={checkAndAdvanceKidLevel}>
                                <Star className="mr-2 h-4 w-4" />
                                Unlock Next Kid Level
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        )}
        
        <Card className="w-full max-w-4xl mx-auto">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl font-headline">Main Menu</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4">
                    {menuItems.map(item => (
                         <Link 
                            href={item.href} 
                            key={item.title} 
                            className={cn(
                                "block group",
                                loadingItem === item.href && "pointer-events-none"
                            )}
                            onClick={() => handleMenuClick(item.href)}
                          >
                            <Card className="h-full hover:border-primary transition-shadow hover:shadow-lg active:scale-95 overflow-hidden rounded-2xl">
                                {item.imageUrl ? (
                                     <div className='flex flex-col h-full'>
                                        <div className="relative w-full aspect-[4/3] bg-white flex items-center justify-center">
                                            {loadingItem === item.href ? (
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            ) : (
                                                <Image 
                                                    src={item.imageUrl} 
                                                    alt={item.title} 
                                                    fill 
                                                    className="object-contain"
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1 flex items-center justify-center p-1">
                                            <CardTitle className='font-headline text-lg'>{item.title}</CardTitle>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <CardHeader className="flex flex-row items-center gap-4">
                                             {loadingItem === item.href ? (
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            ) : (
                                                <div className="p-3 rounded-full bg-primary/10 text-primary">
                                                    <item.icon className="h-6 w-6" />
                                                </div>
                                            )}
                                            <CardTitle className='font-headline text-lg'>{item.title}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-muted-foreground text-sm">{item.description}</p>
                                         </CardContent>
                                    </>
                                )}
                            </Card>
                        </Link>
                    ))}
                </div>
            </CardContent>
        </Card>
        {showBunny && nextMission && <BunnyAssistant mission={nextMission} onClose={() => setShowBunny(false)} />}
      </main>
      <footer className="text-center p-4 text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} AttenWell. All rights reserved.</p>
      </footer>
    </div>
  );
}
