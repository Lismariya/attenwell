
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, BarChart, FileEdit, Save, PieChartIcon, History, ChevronLeft, ChevronRight, Settings, Lock, RotateCcw, Clock } from 'lucide-react';
import { Header } from '@/components/header';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Tooltip } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, getWeek, startOfWeek, isBefore, differenceInCalendarDays } from 'date-fns';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useUser, useDoc, useFirestore, useMemoFirebase, addDocumentNonBlocking, useCollection } from '@/firebase';
import { doc, updateDoc, collection, serverTimestamp, query, orderBy, addDoc, limit, getDocs, deleteDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from '@/components/ui/progress';
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
import type { UserProfile, WeeklyProgress } from '@/types/user';

const skillLabels: { [key: string]: string } = {
  attention: 'Attention',
  working_memory: 'Working Memory',
  inhibitory_control: 'Inhibitory Control',
  problem_solving: 'Problem Solving',
};

const chartConfig = {
    value: {
        label: "Value",
    },
    attention: {
        label: "Attention",
        color: "hsl(var(--chart-1))",
    },
    working_memory: {
        label: "Working Memory",
        color: "hsl(var(--chart-2))",
    },
    inhibitory_control: {
        label: "Inhibitory Control",
        color: "hsl(var(--chart-3))",
    },
    problem_solving: {
        label: "Problem Solving",
        color: "hsl(var(--chart-4))",
    },
};

const SkillProgressCircle = ({ skill, value, color } : { skill: string, value: number, color: string }) => {
    const cappedValue = Math.min(100, value);
    const data = [{ name: skill, value: cappedValue, fill: color }];
    return (
        <div className='flex flex-col items-center gap-1 w-full'>
            <div className='w-full max-w-[100px] sm:max-w-[120px] aspect-square'>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Tooltip
                            contentStyle={{
                                background: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "var(--radius)",
                            }}
                        />
                        <Pie
                            data={[{ value: 100 }]}
                            dataKey="value"
                            stroke="hsl(var(--border))"
                            innerRadius="70%"
                            outerRadius="90%"
                            startAngle={90}
                            endAngle={450}
                            cy="50%"
                            cx="50%"
                            fill="hsl(var(--muted))"
                        />
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="70%"
                            outerRadius="90%"
                            startAngle={90}
                            endAngle={90 + (cappedValue / 100) * 360}
                            cy="50%"
                            cx="50%"
                            cornerRadius={5}
                            fill={color}
                        />
                         <foreignObject x="0" y="0" width="100%" height="100%">
                            <div className="flex items-center justify-center h-full w-full">
                                <p className='text-base sm:text-lg font-bold' style={{ color }}>{cappedValue}%</p>
                            </div>
                        </foreignObject>
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <p className='text-xs font-medium text-muted-foreground text-center'>{skill}</p>
        </div>
    )
}

const ProgressChart = ({ data, title, userProfile }: { data: any[], title: string, userProfile: UserProfile | null | undefined }) => {
    if (!data) {
        return <Skeleton className="h-[250px] w-full" />;
    }
    if (data.length === 0) {
        let message = `No data for ${title}.`;
        if (title === "Previous Week") {
            if (!userProfile) {
                message = "Loading user data...";
            } else {
                const lastResetDate = new Date(userProfile.progressLastResetAt || userProfile.dateJoined);
                const today = new Date();
                const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 });
                
                // If account was created/reset this week, show countdown.
                if (!isBefore(lastResetDate, startOfThisWeek)) {
                   const daysPassedSinceReset = differenceInCalendarDays(today, lastResetDate);
                   const daysLeftInFullWeek = 7 - (daysPassedSinceReset % 7);
                   message = `${daysLeftInFullWeek} days left to complete your first full week snapshot.`;
                } else {
                    message = "No progress was recorded for the previous week.";
                }
            }
        }
        return <div className="h-[250px] flex items-center justify-center text-center p-4 text-muted-foreground">{message}</div>;
    }
    return (
      <div className="h-[250px] w-full">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <RechartsBarChart accessibilityLayer data={data} margin={{ top: 5, right: 20, bottom: 5, left: -35 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} tickMargin={10} domain={[0, 100]} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={30} />
          </RechartsBarChart>
        </ChartContainer>
      </div>
    );
};


const ITEMS_PER_PAGE = 5;
const STORAGE_KEY_STUDY_TIME = 'focusSession_studyTime';
const STORAGE_KEY_RELAX_TIME = 'focusSession_relaxTime';
const STORAGE_KEY_CAMERA_ENABLED = 'focusSession_cameraEnabled';
const STORAGE_KEY_PRIMARY_DELAY = 'focusSession_primaryDelay';
const STORAGE_KEY_WARNING_DELAY = 'focusSession_warningDelay';
const STORAGE_KEY_TERMINATION_DELAY = 'focusSession_terminationDelay';
const STORAGE_KEY_FOCUS_HISTORY = 'focusSession_history';
const STORAGE_KEY_MEDITATION_HISTORY = 'meditation_history';
const STORAGE_KEY_GAME_HISTORY = 'game_history';


export default function ParentsDashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');

  const userDocRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null
  , [user, firestore]);
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const [childAge, setChildAge] = useState(userProfile?.age || 8);
  const [isEditingAge, setIsEditingAge] = useState(false);
  const [isEditingMpin, setIsEditingMpin] = useState(false);
  const [newMpin, setNewMpin] = useState('');
  const [confirmNewMpin, setConfirmNewMpin] = useState('');
  const [historyPage, setHistoryPage] = useState(0);

  // Focus Session Settings
  const [studyTime, setStudyTime] = useState(25);
  const [relaxTime, setRelaxTime] = useState(5);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [primaryAbsenceDelay, setPrimaryAbsenceDelay] = useState(10);
  const [warningCountdownDelay, setWarningCountdownDelay] = useState(10);
  const [terminationCountdownDelay, setTerminationCountdownDelay] = useState(10);

  // Play Time Settings
  const [playTimeLimit, setPlayTimeLimit] = useState(30);

  const [combinedHistory, setCombinedHistory] = useState<any[]>([]);
  
  // Feedback Notes State
  const [newNote, setNewNote] = useState('');
  const [noteHistoryPage, setNoteHistoryPage] = useState(0);

  const feedbackNotesCollectionRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'feedbackNotes') : null
  , [user, firestore]);

  const feedbackNotesQuery = useMemoFirebase(() => 
    feedbackNotesCollectionRef ? query(feedbackNotesCollectionRef, orderBy('timestamp', 'desc')) : null
  , [feedbackNotesCollectionRef]);

  const { data: feedbackNotes, isLoading: areNotesLoading } = useCollection<{note: string, timestamp: { toDate: () => Date }}>(feedbackNotesQuery);

  const weeklyProgressCollectionRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'weeklyProgress') : null, 
  [user, firestore]);

  const weeklyProgressQuery = useMemoFirebase(() => 
      weeklyProgressCollectionRef ? query(weeklyProgressCollectionRef, orderBy('timestamp', 'desc'), limit(2)) : null,
  [weeklyProgressCollectionRef]);

  const { data: weeklySnapshots, isLoading: areSnapshotsLoading } = useCollection<WeeklyProgress>(weeklyProgressQuery);


  const isLoading = isUserLoading || isProfileLoading;
  
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedStudyTime = localStorage.getItem(STORAGE_KEY_STUDY_TIME);
            const storedRelaxTime = localStorage.getItem(STORAGE_KEY_RELAX_TIME);
            const storedCameraEnabled = localStorage.getItem(STORAGE_KEY_CAMERA_ENABLED);
            const storedPrimaryDelay = localStorage.getItem(STORAGE_KEY_PRIMARY_DELAY);
            const storedWarningDelay = localStorage.getItem(STORAGE_KEY_WARNING_DELAY);
            const storedTerminationDelay = localStorage.getItem(STORAGE_KEY_TERMINATION_DELAY);

            if (storedStudyTime) setStudyTime(parseInt(storedStudyTime, 10));
            if (storedRelaxTime) setRelaxTime(parseInt(storedRelaxTime, 10));
            if (storedCameraEnabled) setIsCameraEnabled(storedCameraEnabled === 'true');
            if (storedPrimaryDelay) setPrimaryAbsenceDelay(parseInt(storedPrimaryDelay, 10));
            if (storedWarningDelay) setWarningCountdownDelay(parseInt(storedWarningDelay, 10));
            if (storedTerminationDelay) setTerminationCountdownDelay(parseInt(storedTerminationDelay, 10));
        }
    }, []);

    useEffect(() => {
        if (userProfile) {
            setChildAge(userProfile.age);
            setPlayTimeLimit(userProfile.dailyPlayTimeLimit || 30);
        }
    }, [userProfile]);

    useEffect(() => {
        if (!isAuthenticated) return;

        const focusHistoryString = localStorage.getItem(STORAGE_KEY_FOCUS_HISTORY);
        const focusHistory = focusHistoryString 
            ? JSON.parse(focusHistoryString).map((item: any) => ({...item, timestamp: new Date(item.timestamp)})) 
            : [];
        
        const meditationHistoryString = localStorage.getItem(STORAGE_KEY_MEDITATION_HISTORY);
        const meditationHistory = meditationHistoryString 
            ? JSON.parse(meditationHistoryString).map((item: any) => ({...item, name: 'Meditation', timestamp: new Date(item.timestamp)})) 
            : [];
        
        const gameHistoryString = localStorage.getItem(STORAGE_KEY_GAME_HISTORY);
        const gameHistory = gameHistoryString
            ? JSON.parse(gameHistoryString).map((item: any) => ({...item, timestamp: new Date(item.timestamp)}))
            : [];

        const allHistory = [...gameHistory, ...focusHistory, ...meditationHistory]
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        setCombinedHistory(allHistory);
    }, [isAuthenticated]);

  const calculatedSkills = useMemo(() => {
    if (!userProfile?.gameProgress) {
        return { attention: 0, working_memory: 0, inhibitory_control: 0, problem_solving: 0 };
    }
    const gameProgress = userProfile.gameProgress;
    const maxLevels = {
        'noise-ninjas': 10,
        'track-the-ball': 12,
        'catch-the-right-one': 10,
        'memory-match': 12,
        'hit-the-monster': 10,
        'jigsaw-puzzle': 12,
    };

    const attentionScore = (
        ((gameProgress['noise-ninjas'] || 0) / maxLevels['noise-ninjas']) +
        ((gameProgress['track-the-ball'] || 0) / maxLevels['track-the-ball']) +
        ((gameProgress['hit-the-monster'] || 0) / maxLevels['hit-the-monster']) +
        ((gameProgress['catch-the-right-one'] || 0) / maxLevels['catch-the-right-one'])
    ) / 4;

    const workingMemoryScore = (
        ((gameProgress['memory-match'] || 0) / maxLevels['memory-match']) +
        ((gameProgress['jigsaw-puzzle'] || 0) / maxLevels['jigsaw-puzzle']) +
        ((gameProgress['track-the-ball'] || 0) / maxLevels['track-the-ball'])
    ) / 3;

    const inhibitoryControlScore = (
        ((gameProgress['noise-ninjas'] || 0) / maxLevels['noise-ninjas']) +
        ((gameProgress['hit-the-monster'] || 0) / maxLevels['hit-the-monster']) +
        ((gameProgress['catch-the-right-one'] || 0) / maxLevels['catch-the-right-one'])
    ) / 3;

    const problemSolvingScore = (
        ((gameProgress['jigsaw-puzzle'] || 0) / maxLevels['jigsaw-puzzle']) +
        ((gameProgress['memory-match'] || 0) / maxLevels['memory-match'])
    ) / 2;

    return {
        attention: Math.min(100, Math.floor(attentionScore * 100)),
        working_memory: Math.min(100, Math.floor(workingMemoryScore * 100)),
        inhibitory_control: Math.min(100, Math.floor(inhibitoryControlScore * 100)),
        problem_solving: Math.min(100, Math.floor(problemSolvingScore * 100)),
    };
  }, [userProfile]);

    const getWeekId = (date: Date) => {
        const year = date.getFullYear();
        const week = getWeek(date, { weekStartsOn: 1 }); // Monday start
        return `${year}-W${String(week).padStart(2, '0')}`;
    };

    useEffect(() => {
        if (!user || !userProfile || !weeklyProgressCollectionRef || areSnapshotsLoading) return;

        const currentWeekId = getWeekId(new Date());
        const latestSnapshot = weeklySnapshots && weeklySnapshots.length > 0 ? weeklySnapshots[0] : null;

        if (!latestSnapshot || latestSnapshot.weekId !== currentWeekId) {
            const newSnapshot = {
                ...calculatedSkills,
                weekId: currentWeekId,
                timestamp: serverTimestamp(),
            };
            addDoc(weeklyProgressCollectionRef, newSnapshot);
        }
    }, [user, userProfile, weeklyProgressCollectionRef, areSnapshotsLoading, weeklySnapshots, calculatedSkills]);

    const { currentWeekData, previousWeekData } = useMemo(() => {
        const currentWeekId = getWeekId(new Date());
        const currentSnapshot = weeklySnapshots?.find(s => s.weekId === currentWeekId);
        const previousSnapshot = weeklySnapshots?.find(s => s.weekId !== currentWeekId);

        const formatChartData = (snapshot: WeeklyProgress | undefined) => {
            if (!snapshot) return [];
            return Object.keys(skillLabels).map((skill) => ({
                name: skillLabels[skill as keyof typeof skillLabels],
                value: snapshot[skill as keyof typeof skillLabels] || 0,
                fill: `hsl(var(--chart-${Object.keys(skillLabels).indexOf(skill) + 1}))`
            }));
        };

        return {
            currentWeekData: formatChartData(currentSnapshot),
            previousWeekData: formatChartData(previousSnapshot)
        };
    }, [weeklySnapshots]);
  
  const overallData = useMemo(() => {
    if (!calculatedSkills) return [];
    return Object.keys(skillLabels).map((skill) => ({
      name: skillLabels[skill as keyof typeof skillLabels],
      value: calculatedSkills[skill as keyof typeof calculatedSkills] || 0,
      fill: `hsl(var(--chart-${Object.keys(skillLabels).indexOf(skill) + 1}))`
    }));
  }, [calculatedSkills]);

  const handleSaveAge = async () => {
    if (userDocRef) {
        try {
            await updateDoc(userDocRef, { age: childAge });
            toast({ title: 'Age Updated', description: `Child's age has been updated to ${childAge}.` });
            setIsEditingAge(false);
        } catch (error) {
             toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update age.' });
        }
    }
  }

  const handleSaveMpin = async () => {
    if (newMpin.length !== 4 || !/^\d{4}$/.test(newMpin)) {
        toast({ variant: 'destructive', title: 'Invalid PIN', description: 'PIN must be 4 digits.' });
        return;
    }
    if (newMpin !== confirmNewMpin) {
        toast({ variant: 'destructive', title: "PINs don't match" });
        return;
    }

    if (userDocRef) {
        try {
            await updateDoc(userDocRef, { mpin: newMpin });
            toast({ title: 'PIN Updated Successfully' });
            setIsEditingMpin(false);
            setNewMpin('');
            setConfirmNewMpin('');
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: 'Could not update your PIN. Please try again.',
            });
        }
    }
  };

  const handleSaveFocusSettings = () => {
    localStorage.setItem(STORAGE_KEY_STUDY_TIME, studyTime.toString());
    localStorage.setItem(STORAGE_KEY_RELAX_TIME, relaxTime.toString());
    localStorage.setItem(STORAGE_KEY_CAMERA_ENABLED, isCameraEnabled.toString());
    localStorage.setItem(STORAGE_KEY_PRIMARY_DELAY, primaryAbsenceDelay.toString());
    localStorage.setItem(STORAGE_KEY_WARNING_DELAY, warningCountdownDelay.toString());
    localStorage.setItem(STORAGE_KEY_TERMINATION_DELAY, terminationCountdownDelay.toString());

    toast({
        title: 'Settings Saved',
        description: 'Focus Session settings have been updated.',
    });
  }

  const handleSavePlayTimeLimit = async () => {
    if (userDocRef) {
        try {
            await updateDoc(userDocRef, { dailyPlayTimeLimit: playTimeLimit });
            toast({ title: 'Play Time Updated', description: `Daily limit set to ${playTimeLimit} minutes.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update time limit.' });
        }
    }
  };

    const handleResetProgress = async () => {
        if (userDocRef && weeklyProgressCollectionRef) {
            try {
                // 1. Delete all documents in the weeklyProgress subcollection
                const weeklyProgressSnapshot = await getDocs(weeklyProgressCollectionRef);
                const deletePromises = weeklyProgressSnapshot.docs.map((doc) => deleteDoc(doc.ref));
                await Promise.all(deletePromises);

                // 2. Reset the main user profile document
                const resetPayload = {
                    kid_level: 1,
                    coin: 0,
                    gameProgress: {
                        'noise-ninjas': 0, 'track-the-ball': 0, 'catch-the-right-one': 0,
                        'memory-match': 0, 'hit-the-monster': 0, 'jigsaw-puzzle': 0,
                    },
                    levelProgress: {},
                    playTimeSpentToday: 0,
                    progressLastResetAt: new Date().toISOString(),
                };
                await updateDoc(userDocRef, resetPayload);

                // Clear local storage for games
                localStorage.removeItem('noiseNinjas_highLevel');
                localStorage.removeItem('trackTheBall_highestLevel');
                localStorage.removeItem('catchTheRightOne_highLevel');
                localStorage.removeItem('memoryMatch_highLevel');
                localStorage.removeItem('hitTheMonster_highLevel');
                localStorage.removeItem('jigsawPuzzle_highLevel');
                localStorage.removeItem(STORAGE_KEY_GAME_HISTORY);
                localStorage.removeItem(STORAGE_KEY_FOCUS_HISTORY);
                localStorage.removeItem(STORAGE_KEY_MEDITATION_HISTORY);
                
                toast({ title: 'Progress Reset', description: "Your child's progress has been reset." });
            } catch (error) {
                toast({ variant: 'destructive', title: 'Reset Failed', description: 'Could not reset progress.' });
            }
        }
    };

  const handleSaveNote = () => {
    if (!newNote.trim() || !user || !feedbackNotesCollectionRef) return;
    
    addDocumentNonBlocking(feedbackNotesCollectionRef, {
      note: newNote,
      timestamp: serverTimestamp(),
      userId: user.uid,
    });
    
    setNewNote('');
    toast({ title: 'Note Saved' });
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !userProfile) return;
    if (pinInput === userProfile.mpin) {
        setIsAuthenticated(true);
    } else {
        toast({
            variant: 'destructive',
            title: 'Incorrect PIN',
            description: 'The PIN you entered is incorrect. Please try again.',
        });
        setPinInput('');
    }
  };

  const maxHistoryPage = Math.ceil(combinedHistory.length / ITEMS_PER_PAGE) - 1;

  const handleHistoryNext = () => {
    setHistoryPage(p => Math.min(p + 1, maxHistoryPage));
  };
  const handleHistoryPrev = () => {
      setHistoryPage(p => Math.max(p - 1, 0));
  };

  const paginatedHistory = combinedHistory.slice(
    historyPage * ITEMS_PER_PAGE,
    (historyPage + 1) * ITEMS_PER_PAGE
  );
  
  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  const maxNoteHistoryPage = feedbackNotes ? Math.ceil(feedbackNotes.length / ITEMS_PER_PAGE) - 1 : 0;
  const handleNoteHistoryNext = () => setNoteHistoryPage(p => Math.min(p + 1, maxNoteHistoryPage));
  const handleNoteHistoryPrev = () => setNoteHistoryPage(p => Math.max(p - 1, 0));

  const paginatedNotes = useMemo(() => {
      if (!feedbackNotes) return [];
      return feedbackNotes.slice(
          noteHistoryPage * ITEMS_PER_PAGE,
          (noteHistoryPage + 1) * ITEMS_PER_PAGE
      );
  }, [feedbackNotes, noteHistoryPage]);

  const spentMinutes = Math.floor((userProfile?.playTimeSpentToday || 0) / 60);
  const playTimePercent = Math.min(100, ((userProfile?.playTimeSpentToday || 0) / ((userProfile?.dailyPlayTimeLimit || 30) * 60)) * 100);

  if (isLoading) {
    return (
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#F3F4F3' }}>
            <Header />
            <main className="flex-1 container mx-auto p-4 md:px-6 md:py-8 flex items-center justify-center">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle>Loading Dashboard...</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="w-24 h-24 rounded-full mx-auto" />
                        <Skeleton className="h-6 w-3/4 mx-auto mt-4" />
                    </CardContent>
                </Card>
            </main>
        </div>
    );
  }

  if (!isAuthenticated) {
    return (
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#F3F4F3' }}>
            <Header />
            <main className="flex-1 container mx-auto p-4 md:px-6 md:py-8 flex items-center justify-center">
                <Card className="w-full max-w-sm">
                    <form onSubmit={handlePinSubmit}>
                        <CardHeader className="text-center">
                            <Lock className="mx-auto h-12 w-12 text-primary" />
                            <CardTitle className="mt-4">Enter PIN</CardTitle>
                            <CardDescription>Enter your 4-digit parent PIN to access the dashboard.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Input
                                id="pin-input"
                                type="password"
                                maxLength={4}
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value)}
                                className="text-center text-2xl tracking-[1rem]"
                                required
                                pattern="\d{4}"
                            />
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" type="submit">Unlock</Button>
                        </CardFooter>
                    </form>
                </Card>
            </main>
        </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#F3F4F3' }}>
      <Header />
      <main className="flex-1 container mx-auto p-4 md:px-6 md:py-8">
        <div className="grid gap-4 md:gap-8 lg:grid-cols-3">
          <div className="space-y-4 md:space-y-8 lg:col-span-1">
             <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                    <User className="w-8 h-8 text-primary"/>
                    <CardTitle className="font-headline text-xl">Child Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {userProfile ? (
                        <>
                           <div>
                               <Label className="text-muted-foreground">Name</Label>
                               <p className="font-semibold">{userProfile.displayName}</p>
                           </div>
                            <div>
                               <Label className="text-muted-foreground">Age</Label>
                               <div className="flex items-center gap-2">
                                   {isEditingAge ? (
                                       <Input type="number" value={childAge} onChange={(e) => setChildAge(Number(e.target.value))} className="w-20"/>
                                   ) : (
                                       <p className="font-semibold">{childAge}</p>
                                   )}
                                   {isEditingAge ? (
                                       <Button size="sm" onClick={handleSaveAge}><Save className="w-4 h-4 mr-2"/>Save</Button>
                                   ) : (
                                       <Button size="sm" variant="ghost" onClick={() => setIsEditingAge(true)}><FileEdit className="w-4 h-4"/></Button>
                                   )}
                               </div>
                           </div>
                            <div>
                               <Label className="text-muted-foreground">Email</Label>
                               <p className="font-semibold">{userProfile.email}</p>
                           </div>
                           <div>
                                <Label className="text-muted-foreground">Kid Level</Label>
                                <p className="font-semibold">{userProfile.kid_level}</p>
                            </div>
                           <div>
                               <Label className="text-muted-foreground">PIN</Label>
                               <div className="flex items-center gap-2">
                                   {isEditingMpin ? (
                                       <p className="font-semibold text-sm text-muted-foreground">Enter new PIN below</p>
                                   ) : (
                                       <p className="font-semibold tracking-widest">••••</p>
                                   )}
                                    {!isEditingMpin && (
                                        <Button size="sm" variant="ghost" onClick={() => setIsEditingMpin(true)}><FileEdit className="w-4 h-4"/></Button>
                                    )}
                               </div>
                           </div>
                            {isEditingMpin && (
                                <div className="space-y-4 pt-4 border-t">
                                    <div className="grid gap-2">
                                        <Label htmlFor="new-mpin">New 4-Digit PIN</Label>
                                        <Input id="new-mpin" type="password" value={newMpin} onChange={(e) => setNewMpin(e.target.value)} maxLength={4} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="confirm-new-mpin">Confirm New PIN</Label>
                                        <Input id="confirm-new-mpin" type="password" value={confirmNewMpin} onChange={(e) => setConfirmNewMpin(e.target.value)} maxLength={4} />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button onClick={handleSaveMpin}>Save PIN</Button>
                                        <Button variant="ghost" onClick={() => setIsEditingMpin(false)}>Cancel</Button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <p>Could not load profile.</p>
                    )}
                </CardContent>
                 <CardFooter>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full">
                                <RotateCcw className="mr-2 h-4 w-4" /> Reset All Progress
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will reset all progress for your child, including their Kid Level, coins, and all game levels. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleResetProgress}>Confirm Reset</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                    <Clock className="w-8 h-8 text-primary"/>
                    <CardTitle className="font-headline text-xl">Play Time Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm mb-1">
                            <Label>Time Used Today</Label>
                            <span className="text-muted-foreground font-mono">{spentMinutes} / {userProfile?.dailyPlayTimeLimit}m</span>
                        </div>
                        <Progress value={playTimePercent} className="h-3" />
                        {playTimePercent >= 100 && (
                            <p className="text-xs text-destructive font-medium mt-1">Daily limit reached!</p>
                        )}
                    </div>

                    <div className="space-y-4 pt-2 border-t">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="play-limit">Daily Play Limit</Label>
                            <span className="text-primary font-bold">{playTimeLimit} mins</span>
                        </div>
                        <Slider
                            id="play-limit"
                            min={5}
                            max={120}
                            step={5}
                            value={[playTimeLimit]}
                            onValueChange={(v) => setPlayTimeLimit(v[0])}
                        />
                        <Button onClick={handleSavePlayTimeLimit} className="w-full" variant="outline">
                            <Save className="mr-2 h-4 w-4" /> Update Limit
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                    <Settings className="w-8 h-8 text-primary"/>
                    <CardTitle className="font-headline text-xl">Focus Session Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="camera-enabled">Enable Camera & Motion Detection</Label>
                        <Switch
                            id="camera-enabled"
                            checked={isCameraEnabled}
                            onCheckedChange={setIsCameraEnabled}
                        />
                    </div>
                   <div className="grid gap-3">
                        <Label htmlFor="study-time">Study Time: {studyTime} minutes</Label>
                        <Slider
                            id="study-time"
                            min={5}
                            max={60}
                            step={5}
                            value={[studyTime]}
                            onValueChange={(value) => setStudyTime(value[0])}
                        />
                    </div>
                    <div className="grid gap-3">
                        <Label htmlFor="relax-time">Relax Time: {relaxTime} minutes</Label>
                        <Slider
                            id="relax-time"
                            min={1}
                            max={15}
                            step={1}
                            value={[relaxTime]}
                            onValueChange={(value) => setRelaxTime(value[0])}
                        />
                    </div>
                     <div className="grid gap-3 pt-2">
                        <Label htmlFor="primary-delay">Primary Absence Delay: {primaryAbsenceDelay} seconds</Label>
                        <Slider
                            id="primary-delay"
                            min={1}
                            max={60}
                            step={1}
                            value={[primaryAbsenceDelay]}
                            onValueChange={(value) => setPrimaryAbsenceDelay(value[0])}
                            disabled={!isCameraEnabled}
                        />
                    </div>
                     <div className="grid gap-3">
                        <Label htmlFor="warning-delay">Warning Countdown: {warningCountdownDelay} seconds</Label>
                        <Slider
                            id="warning-delay"
                            min={1}
                            max={60}
                            step={1}
                            value={[warningCountdownDelay]}
                            onValueChange={(value) => setWarningCountdownDelay(value[0])}
                            disabled={!isCameraEnabled}
                        />
                    </div>
                     <div className="grid gap-3">
                        <Label htmlFor="termination-delay">Termination Countdown: {terminationCountdownDelay} seconds</Label>
                        <Slider
                            id="termination-delay"
                            min={1}
                            max={60}
                            step={1}
                            value={[terminationCountdownDelay]}
                            onValueChange={(value) => setTerminationCountdownDelay(value[0])}
                            disabled={!isCameraEnabled}
                        />
                    </div>

                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveFocusSettings} className="w-full">
                        <Save className="mr-2 h-4 w-4" /> Save Settings
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                    <History className="w-8 h-8 text-primary"/>
                    <CardTitle className="font-headline text-xl">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                   {paginatedHistory.length > 0 ? (
                        paginatedHistory.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-sm">
                                <div>
                                    <p className="font-semibold">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{format(item.timestamp, "PPP p")}</p>
                                </div>
                                <p className={cn("font-medium text-right", item.status.includes('Terminated') || item.status.includes('Stopped') ? 'text-destructive' : 'text-primary')}>
                                    {item.name === 'Meditation' ? `${item.status} - ${formatSeconds(item.actualTime)}` : item.status}
                                </p>
                            </div>
                        ))
                   ) : (
                       <p className="text-center text-muted-foreground">No recent activity.</p>
                   )}
                </CardContent>
                {combinedHistory.length > ITEMS_PER_PAGE && (
                    <CardFooter className="flex justify-between items-center pt-4">
                        <Button variant="ghost" size="icon" onClick={handleHistoryPrev} disabled={historyPage === 0}>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {historyPage + 1} of {maxHistoryPage + 1}
                        </span>
                        <Button variant="ghost" size="icon" onClick={handleHistoryNext} disabled={historyPage === maxHistoryPage}>
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </CardFooter>
                )}
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                    <PieChartIcon className="w-8 h-8 text-primary"/>
                    <CardTitle className="font-headline text-xl">Current Skills</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-x-2 gap-y-4 items-start justify-items-center">
                    {isLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-1 w-full">
                           <Skeleton className="w-full max-w-[100px] sm:max-w-[120px] aspect-square rounded-full" />
                           <Skeleton className="h-4 w-20 mt-1" />
                        </div>
                      ))
                    ) : userProfile ? (
                      <>
                        <SkillProgressCircle skill="Attention" value={calculatedSkills.attention} color={'hsl(var(--chart-1))'} />
                        <SkillProgressCircle skill="Working Memory" value={calculatedSkills.working_memory} color={'hsl(var(--chart-2))'} />
                        <SkillProgressCircle skill="Inhibitory Control" value={calculatedSkills.inhibitory_control} color={'hsl(var(--chart-3))'} />
                        <SkillProgressCircle skill="Problem Solving" value={calculatedSkills.problem_solving} color={'hsl(var(--chart-4))'} />
                      </>
                    ) : (
                      <p>Could not load skills.</p>
                    )}
                </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-2">
             <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <BarChart className="w-8 h-8 text-primary" />
                  <CardTitle className="font-headline text-xl">Skill Progress</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-0 sm:px-4">
                 <Tabs defaultValue="overall">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="overall">Overall</TabsTrigger>
                        <TabsTrigger value="current">Current Week</TabsTrigger>
                        <TabsTrigger value="previous">Previous Week</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overall" className="mt-4">
                        <ProgressChart data={overallData} title="Overall Progress" userProfile={userProfile} />
                    </TabsContent>
                    <TabsContent value="current" className="mt-4">
                        <ProgressChart data={currentWeekData} title="Current Week" userProfile={userProfile} />
                    </TabsContent>
                    <TabsContent value="previous" className="mt-4">
                        <ProgressChart data={previousWeekData} title="Previous Week" userProfile={userProfile} />
                    </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            <Card className="mt-4 md:mt-8">
                <CardHeader>
                    <CardTitle className="font-headline text-xl flex items-center gap-4">
                    <FileEdit className="w-8 h-8 text-primary"/>
                    Feedback Notes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="add">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="add">Add Note</TabsTrigger>
                        <TabsTrigger value="history">History</TabsTrigger>
                    </TabsList>
                    <TabsContent value="add" className="pt-4">
                        <div className="space-y-2">
                        <Label htmlFor="feedback-note">New Feedback Note</Label>
                        <Textarea
                            id="feedback-note"
                            placeholder="Add a note about your child's progress, behaviors, or milestones..."
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            rows={4}
                        />
                        </div>
                        <Button onClick={handleSaveNote} disabled={!newNote.trim()} className="mt-4">
                        <Save className="mr-2 h-4 w-4" />
                        Save Note
                        </Button>
                    </TabsContent>
                    <TabsContent value="history" className="pt-4">
                        <div className="space-y-4">
                        {areNotesLoading ? (
                            <p>Loading notes...</p>
                        ) : paginatedNotes && paginatedNotes.length > 0 ? (
                            paginatedNotes.map((note) => (
                            <div key={note.id} className="text-sm p-3 rounded-md bg-muted/50 border">
                                <p className="text-muted-foreground text-xs mb-1">
                                {note.timestamp ? format(note.timestamp.toDate(), "PPP p") : 'Date unavailable'}
                                </p>
                                <p>{note.note}</p>
                            </div>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground">No feedback notes yet.</p>
                        )}
                        </div>
                        {feedbackNotes && feedbackNotes.length > ITEMS_PER_PAGE && (
                        <div className="flex justify-between items-center pt-4 mt-4 border-t">
                            <Button variant="ghost" size="icon" onClick={handleNoteHistoryPrev} disabled={noteHistoryPage === 0}>
                            <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <span className="text-sm text-muted-foreground">
                            Page {noteHistoryPage + 1} of {maxNoteHistoryPage + 1}
                            </span>
                            <Button variant="ghost" size="icon" onClick={handleNoteHistoryNext} disabled={noteHistoryPage === maxNoteHistoryPage}>
                            <ChevronRight className="h-5 w-5" />
                            </Button>
                        </div>
                        )}
                    </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
