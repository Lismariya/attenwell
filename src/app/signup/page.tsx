
'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase/client';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useUser } from '@/firebase';
import { format } from 'date-fns';

export default function SignupPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [mpin, setMpin] = useState('');
  const [gender, setGender] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && user) {
      router.push('/home');
    }
  }, [user, isAuthLoading, router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Passwords do not match',
        description: 'Please check your password and confirm password fields.',
      });
      return;
    }
    
    if (mpin.length !== 4 || !/^\d{4}$/.test(mpin)) {
      toast({
        variant: 'destructive',
        title: 'Invalid PIN',
        description: 'Parent PIN must be 4 digits.',
      });
      return;
    }
    
    if (!gender) {
      toast({
        variant: 'destructive',
        title: 'Gender not selected',
        description: 'Please select a gender.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName });
      
      const avatarUrl = gender === 'female' 
        ? 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/avatar1.svg?alt=media&token=cbe96bb6-d4ef-49a2-9dfa-a8603377cd33'
        : 'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/avatar2.svg?alt=media&token=534c41e9-4aab-401d-bc75-207a287400ef';

      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        id: user.uid,
        displayName,
        email,
        age: Number(age),
        dateJoined: new Date().toISOString(),
        progressLastResetAt: new Date().toISOString(),
        coin: 0,
        kid_level: 1,
        mpin,
        gender,
        avatarUrl,
        dailyPlayTimeLimit: 30, // Default 30 mins
        playTimeSpentToday: 0,
        playTimeLastResetDate: format(new Date(), 'yyyy-MM-dd'),
        levelProgress: {},
        cycleProgress: {
          'noise-ninjas': false,
          'track-the-ball': false,
          'catch-the-right-one': false,
          'memory-match': false,
          'hit-the-monster': false,
          'jigsaw-puzzle': false,
          'meditation': false,
          'focus-session': false,
        },
        gameProgress: {
          'noise-ninjas': 0,
          'track-the-ball': 0,
          'catch-the-right-one': 0,
          'memory-match': 0,
          'hit-the-monster': 0,
          'jigsaw-puzzle': 0,
        }
      });

      toast({
        title: 'Account Created!',
        description: "You're all set. Please log in with your new account.",
      });
      router.push('/login');

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Signup Failed',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthLoading || user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleSignup}>
          <CardHeader className="text-center">
            <Link href="/" className="flex flex-col justify-center items-center gap-2 text-primary mb-4">
              <Image 
                src="/images/attenwell.jpeg"
                alt="AttenWell Logo" 
                width={64} 
                height={64}
                className="rounded-lg"
              />
            </Link>
            <CardTitle>Create an Account</CardTitle>
            <CardDescription>Enter your details to get started.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="displayName">Child's Name</Label>
              <Input id="displayName" type="text" placeholder="Thakkudu" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="age">Child's Age</Label>
              <Input id="age" type="number" placeholder="8" required value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Gender</Label>
              <RadioGroup
                onValueChange={setGender}
                value={gender}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male">Male</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female">Female</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Parent's Email</Label>
              <Input id="email" type="email" placeholder="parent@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(prev => !prev)}>
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input id="confirm-password" type={showConfirmPassword ? "text" : "password"} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                 <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowConfirmPassword(prev => !prev)}>
                  {showConfirmPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mpin">4-Digit Parent PIN</Label>
              <Input id="mpin" type="password" placeholder="e.g. 1234" required value={mpin} onChange={(e) => setMpin(e.target.value)} maxLength={4} pattern="\d{4}" title="PIN must be 4 digits." />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
            <p className="text-sm text-center">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Login
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
