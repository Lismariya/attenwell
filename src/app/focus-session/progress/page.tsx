
'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Home, RefreshCw, AlertTriangle, VideoOff, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/header';
import * as faceapi from 'face-api.js';
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
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useProgression } from '@/hooks/useProgression';
import type { UserProfile } from '@/types/user';

const STORAGE_KEY_FOCUS_HISTORY = 'focusSession_history';
const STORAGE_KEY_CAMERA_ENABLED = 'focusSession_cameraEnabled';
const STORAGE_KEY_PRIMARY_DELAY = 'focusSession_primaryDelay';
const STORAGE_KEY_WARNING_DELAY = 'focusSession_warningDelay';
const STORAGE_KEY_TERMINATION_DELAY = 'focusSession_terminationDelay';

const BEEP_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/beep-329314.mp3?alt=media&token=3810d1a8-92bd-4158-97a9-cd9e5dc8ef54';
const MODELS_URL = '/models';


function FocusSessionComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const { user } = useUser();
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);
  const { checkAndAdvanceKidLevel } = useProgression();

  // Session Parameters
  const studyTime = parseInt(searchParams.get('study') || '25', 10) * 60;
  const relaxTime = parseInt(searchParams.get('relax') || '5', 10) * 60;
  const totalRounds = parseInt(searchParams.get('rounds') || '4', 10);
  
  // State Management
  const [sessionState, setSessionState] = useState<'study' | 'relax' | 'finished'>('study');
  const [currentRound, setCurrentRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(studyTime);
  const [isSessionActive, setIsSessionActive] = useState(true);
  const [sessionEndStatus, setSessionEndStatus] = useState<'Completed' | 'Terminated' | null>(null);

  
  // Feature Settings from localStorage
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [primaryAbsenceDelay, setPrimaryAbsenceDelay] = useState(10);
  const [warningCountdownDelay, setWarningCountdownDelay] = useState(10);
  const [terminationCountdownDelay, setTerminationCountdownDelay] = useState(10);

  // Hardware/Library State
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  
  // Absence Detection State
  const [absenceState, setAbsenceState] = useState<'present' | 'primary_absence' | 'warning' | 'terminating'>('present');
  const [countdown, setCountdown] = useState(10);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mainTimerRef = useRef<NodeJS.Timeout>();
  const detectionIntervalRef = useRef<NodeJS.Timeout>();
  const absenceTimerRef = useRef<NodeJS.Timeout>(); // Timer to trigger initial absence state
  const countdownTimerRef = useRef<NodeJS.Timeout>(); // Timer for countdowns
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const timeSpentInSession = useRef(0);

  const playSound = useCallback((sound: keyof typeof audioRefs.current) => {
    const audio = audioRefs.current[sound];
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.error("Error playing sound:", e));
    }
  }, []);

  const stopAllTimers = useCallback(() => {
    if (mainTimerRef.current) clearInterval(mainTimerRef.current);
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    if (absenceTimerRef.current) clearTimeout(absenceTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
  }, []);

  const stopAllSounds = useCallback(() => {
    Object.values(audioRefs.current).forEach(audio => {
      if (audio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  }, []);

  const releaseResources = useCallback(() => {
    stopAllTimers();
    stopAllSounds();
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, [stopAllTimers, stopAllSounds]);

  const saveSessionToHistory = useCallback(async (status: 'Completed' | 'Terminated') => {
    const historyString = localStorage.getItem(STORAGE_KEY_FOCUS_HISTORY);
    const history = historyString ? JSON.parse(historyString) : [];
    
    const timeSpent = Math.floor(timeSpentInSession.current / 60);

    const newEntry = {
        id: Date.now(),
        name: 'Focus Session',
        status: `${status} (${timeSpent} min)`,
        timestamp: new Date().toISOString(),
    };

    const updatedHistory = [newEntry, ...history].slice(0, 5);
    localStorage.setItem(STORAGE_KEY_FOCUS_HISTORY, JSON.stringify(updatedHistory));

    if (status === 'Completed' && userDocRef && userProfile) {
        try {
            await updateDoc(userDocRef, {
              'cycleProgress.focus-session': true,
            });
            await checkAndAdvanceKidLevel();
        } catch (error) {
             toast({ variant: 'destructive', title: 'Error', description: 'Failed to save focus session progress.' });
        }
    }
  }, [userDocRef, userProfile, toast, checkAndAdvanceKidLevel]);

  const handleEndSession = useCallback(async (status: 'Completed' | 'Terminated' = 'Terminated') => {
    if(!isSessionActive) return;
    setIsSessionActive(false);
    releaseResources();
    await saveSessionToHistory(status);
    setSessionEndStatus(status);
    setSessionState('finished');
  }, [isSessionActive, saveSessionToHistory, releaseResources]);

  
  // Main setup effect on component mount
  useEffect(() => {
    const cameraEnabled = localStorage.getItem(STORAGE_KEY_CAMERA_ENABLED) !== 'false';
    setIsCameraEnabled(cameraEnabled);

    const primary = localStorage.getItem(STORAGE_KEY_PRIMARY_DELAY);
    const warning = localStorage.getItem(STORAGE_KEY_WARNING_DELAY);
    const termination = localStorage.getItem(STORAGE_KEY_TERMINATION_DELAY);

    if (primary) setPrimaryAbsenceDelay(parseInt(primary, 10));
    if (warning) setWarningCountdownDelay(parseInt(warning, 10));
    if (termination) setTerminationCountdownDelay(parseInt(termination, 10));
    
    audioRefs.current = {
        end: new Audio('https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/end_alert.mp3?alt=media&token=0b674b88-469b-44f2-984e-2895a9d68249'),
        beep: new Audio(BEEP_SOUND_URL),
    };
    Object.values(audioRefs.current).forEach(audio => audio.load());

    const initializeSequence = async () => {
        if (!cameraEnabled) {
            setModelsLoaded(true); // No models to load if camera is off
            setHasCameraPermission(true); // No permission needed
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (error) {
            setHasCameraPermission(false);
            if (error instanceof Error && error.name === 'NotAllowedError') {
                toast({
                    variant: 'destructive',
                    title: 'Camera Access Denied',
                    description: 'Please enable camera permissions in your browser settings to use this feature.',
                });
            } else {
                 toast({
                    variant: 'destructive',
                    title: 'Camera Error',
                    description: 'Could not access the camera. Please ensure it is not in use by another application.',
                });
            }
            return;
        }

        try {
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL)
            setModelsLoaded(true);
        } catch (modelError) {
            console.error('Error loading face-api models:', modelError);
            toast({
                variant: 'destructive',
                title: 'Model Loading Failed',
                description: 'Could not load face detection models. Please check your internet connection and refresh the page.',
            });
        }
    };
    
    initializeSequence();

    return () => {
      releaseResources();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main Session Timer
  useEffect(() => {
    // If the session isn't active, models aren't loaded, or an absence is detected, ensure the timer is stopped.
    if (!isSessionActive || !modelsLoaded || (sessionState === 'study' && absenceState !== 'present')) {
      if (mainTimerRef.current) clearInterval(mainTimerRef.current);
      return;
    }

    mainTimerRef.current = setInterval(() => {
        setTimeLeft(prev => {
            if (prev <= 1) {
                playSound('end');
                if (sessionState === 'study') {
                    if (currentRound < totalRounds) {
                        setSessionState('relax');
                        return relaxTime;
                    } else {
                        handleEndSession('Completed');
                        return 0;
                    }
                } else { // relax
                    setCurrentRound(r => r + 1);
                    setSessionState('study');
                    return studyTime;
                }
            }
            
            if (sessionState === 'study') {
                timeSpentInSession.current += 1;
            }
            return prev - 1;
        });
    }, 1000);

    return () => {
        if(mainTimerRef.current) clearInterval(mainTimerRef.current)
    };
  }, [isSessionActive, sessionState, currentRound, totalRounds, studyTime, relaxTime, playSound, handleEndSession, modelsLoaded, absenceState]);

    // This effect centralizes timer cleanup when absence is resolved.
    useEffect(() => {
      if (absenceState === 'present') {
        if (absenceTimerRef.current) {
          clearTimeout(absenceTimerRef.current);
          absenceTimerRef.current = undefined;
        }
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = undefined;
        }
      }
    }, [absenceState]);
  
    // This effect handles both tab visibility and camera-based absence detection.
    useEffect(() => {
      const handleVisibilityChange = () => {
        // If the tab is hidden during a study session, terminate immediately.
        if (sessionState === 'study' && isSessionActive && document.hidden) {
          handleEndSession('Terminated');
        }
      };
  
      document.addEventListener('visibilitychange', handleVisibilityChange);
  
      // Only set up camera interval if all conditions are met.
      if (isSessionActive && sessionState === 'study' && isCameraEnabled && hasCameraPermission && modelsLoaded) {
        detectionIntervalRef.current = setInterval(async () => {
          if (document.hidden) return; // Don't run face detection if tab is not visible.
  
          let isFaceDetected = false;
          if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
            const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions());
            if (detections.length > 0) {
              isFaceDetected = true;
              const canvas = canvasRef.current;
              if (canvas) {
                  const displaySize = { width: videoRef.current.clientWidth, height: videoRef.current.clientHeight };
                  faceapi.matchDimensions(canvas, displaySize);
                  const resizedDetections = faceapi.resizeResults(detections, displaySize);
                  const context = canvas.getContext('2d');
                  if(context) {
                    context.clearRect(0, 0, canvas.width, canvas.height);
                    resizedDetections.forEach(detection => {
                      const box = detection.box;
                      const drawBox = new faceapi.draw.DrawBox(box, { 
                        label: `Face`,
                        boxColor: 'rgba(0, 255, 0, 1)',
                      });
                      drawBox.draw(canvas);
                    });
                  }
              }
            }
          }
          
          if (isFaceDetected) {
            setAbsenceState('present');
          } else {
            setAbsenceState(currentAbsenceState => {
              if (currentAbsenceState === 'present' && !absenceTimerRef.current) {
                absenceTimerRef.current = setTimeout(() => {
                  setAbsenceState('primary_absence');
                  absenceTimerRef.current = undefined; 
                }, primaryAbsenceDelay * 1000);
              }
              return currentAbsenceState;
            });
          }
        }, 2000); // Check every 2 seconds.
      }
  
      // Cleanup function
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
        if (absenceTimerRef.current) clearTimeout(absenceTimerRef.current);
      };
    
    }, [isSessionActive, sessionState, hasCameraPermission, modelsLoaded, isCameraEnabled, primaryAbsenceDelay, handleEndSession]);


  // Countdown and State Transition Logic
  useEffect(() => {
    if(countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = undefined;

    let countdownDuration = 0;
    if (absenceState === 'primary_absence') {
        countdownDuration = warningCountdownDelay;
    } else if (absenceState === 'warning') {
        countdownDuration = terminationCountdownDelay;
    } else if (absenceState === 'terminating') {
        countdownDuration = terminationCountdownDelay;
    } else { // present or any other state
        return;
    }

    setCountdown(countdownDuration);

    countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => {
            if (prev <= 1) {
                if (absenceState === 'primary_absence') setAbsenceState('warning');
                else if (absenceState === 'warning') setAbsenceState('terminating');
                else if (absenceState === 'terminating') handleEndSession('Terminated');
                return 0;
            }
            if (absenceState === 'terminating') playSound('beep');
            return prev - 1;
        });
    }, 1000);

    return () => {
      if(countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    }
  }, [absenceState, warningCountdownDelay, terminationCountdownDelay, handleEndSession, playSound]);


  const getProgress = () => {
    const totalTime = sessionState === 'study' ? studyTime : relaxTime;
    if (totalTime === 0) return 100;
    return ((totalTime - timeLeft) / totalTime) * 100;
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  const borderClass = () => {
      if (sessionState === 'study') {
        if (absenceState === 'primary_absence') return 'border-yellow-400';
        if (absenceState === 'warning') return 'border-yellow-400';
        if (absenceState === 'terminating') return 'border-red-500';
        return 'border-green-500';
      }
      return 'border-blue-500';
  }
  
  const renderOverlayContent = () => {
    if (sessionState === 'relax') {
      return (
        <div className='text-center'>
            <h2 className='text-2xl sm:text-3xl font-bold'>Relax!</h2>
            <p className='text-base sm:text-lg mt-2'>Time to take a short break.</p>
        </div>
      );
    }
    if (absenceState === 'primary_absence') {
        return (
            <div className='text-center'>
                <AlertTriangle className="h-8 w-8 sm:h-12 sm:w-12 text-yellow-400 mx-auto mb-2 sm:mb-4 animate-pulse" />
                <h2 className='text-xl sm:text-3xl font-bold text-yellow-400'>Are you there?</h2>
                <p className='text-sm sm:text-lg mt-1 sm:mt-2'>Warning in {countdown}...</p>
            </div>
        )
    }
    if (absenceState === 'warning') {
        return (
            <div className='text-center'>
                <AlertTriangle className="h-8 w-8 sm:h-12 sm:w-12 text-yellow-400 mx-auto mb-2 sm:mb-4 animate-pulse" />
                <h2 className='text-xl sm:text-3xl font-bold text-yellow-400'>Absence Warning</h2>
                <p className='text-sm sm:text-lg mt-1 sm:mt-2'>Return to screen. Termination in {countdown}...</p>
            </div>
        )
    }
    if (absenceState === 'terminating') {
        return (
            <div className='text-center'>
                <AlertTriangle className="h-8 w-8 sm:h-12 sm:w-12 text-red-500 mx-auto mb-2 sm:mb-4 animate-pulse" />
                <h2 className='text-xl sm:text-3xl font-bold text-red-500'>Session Terminating</h2>
                <p className='text-sm sm:text-lg mt-1 sm:mt-2'>Session ends in {countdown} seconds.</p>
            </div>
        )
    }
    if (!isCameraEnabled) {
      return (
         <div className='text-center'>
            <VideoOff className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-2 sm:mb-4" />
            <h2 className='text-xl sm:text-3xl font-bold text-muted-foreground'>Camera is Disabled</h2>
        </div>
      )
    }
     if (!modelsLoaded && isCameraEnabled) {
      return (
        <div className='text-center'>
            <h2 className='text-xl sm:text-3xl font-bold'>Loading AI Models...</h2>
            <p className='text-sm sm:text-lg mt-1 sm:mt-2'>Please wait a moment.</p>
        </div>
      );
    }
    if(!hasCameraPermission && isCameraEnabled){
      return (
        <div className='text-center'>
            <VideoOff className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-2 sm:mb-4" />
            <h2 className='text-xl sm:text-3xl font-bold text-muted-foreground'>Waiting for Camera...</h2>
        </div>
      )
    }
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <Header />
      <main className="flex-1 flex items-center justify-center p-2 sm:p-4">
        <Card className="w-full max-w-2xl text-center">
          {sessionState !== 'finished' ? (
            <>
              <CardHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
                <CardTitle className="text-xl md:text-3xl font-headline">
                  {sessionState === 'study' && `Study Session - Round ${currentRound}/${totalRounds}`}
                  {sessionState === 'relax' && `Relax - Round ${currentRound > totalRounds ? totalRounds : currentRound}/${totalRounds}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center gap-4 p-4 sm:p-6">
                <div
                  className={cn(
                    'relative w-full aspect-square max-w-sm mx-auto rounded-md overflow-hidden border-4 transition-colors duration-300 bg-black',
                    borderClass()
                  )}
                >
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline onPlay={() => { if(isCameraEnabled) setHasCameraPermission(true)}} />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                   { (sessionState === 'relax' || absenceState !== 'present' || !isCameraEnabled || !modelsLoaded || (!hasCameraPermission && isCameraEnabled)) && (
                      <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white p-4">
                        {renderOverlayContent()}
                      </div>
                   )}
                </div>
                 { !hasCameraPermission && isCameraEnabled && (
                    <Alert variant="destructive">
                      <AlertTitle>Camera Access Required</AlertTitle>
                      <AlertDescription>
                        Please allow camera access to use this feature.
                      </AlertDescription>
                    </Alert>
                )}
                <div className="w-full flex flex-col items-center gap-2 sm:gap-4">
                  <p className="text-5xl md:text-7xl font-bold font-mono tracking-tighter">
                      {formatTime(timeLeft)}
                  </p>
                  <Progress
                    value={getProgress()}
                    className={cn(
                        'w-full h-3 sm:h-4', 
                        sessionState === 'relax' && '[&>div]:bg-blue-500',
                        (absenceState === 'primary_absence' || absenceState === 'warning') && sessionState === 'study' && '[&>div]:bg-yellow-400',
                        absenceState === 'terminating' && sessionState === 'study' && '[&>div]:bg-red-500',
                      )}
                  />
                </div>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline">
                            <Square className="mr-2 h-4 w-4" />
                            End Session
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will terminate the current focus session. Your progress will be saved.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleEndSession('Terminated')}>Confirm</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center gap-4 sm:gap-6 p-6 sm:p-12">
               {sessionEndStatus === 'Completed' ? (
                <>
                    <h2 className="text-2xl sm:text-3xl font-bold font-headline text-primary">Session Complete!</h2>
                    <p className="text-muted-foreground text-base sm:text-lg">You did a great job focusing. Keep it up!</p>
                </>
               ) : (
                <>
                    <h2 className="text-2xl sm:text-3xl font-bold font-headline text-destructive">Session Terminated</h2>
                    <div className='text-center text-muted-foreground'>
                        <p>A focused mind is a powerful mind. Let's try again!</p>
                        <div className="mt-4 text-left bg-muted/50 p-4 rounded-lg space-y-2">
                           <p><strong>Rounds Completed:</strong> {currentRound-1} / {totalRounds}</p>
                           <p><strong>Total Study Time:</strong> {formatTime(timeSpentInSession.current)}</p>
                        </div>
                    </div>
                </>
               )}
              <div className='flex flex-col sm:flex-row gap-4 mt-4 w-full max-w-sm'>
                  <Button className="w-full" onClick={() => router.push('/focus-session')}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      New Session
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                      <Link href="/home">
                          <Home className="mr-2 h-4 w-4" />
                          Main Menu
                      </Link>
                  </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  );
}

export default function FocusSessionProgressPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading session...</div>}>
            <FocusSessionComponent />
        </Suspense>
    )
}

    