
'use client';

import { useCallback } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { KID_LEVELS_CONFIG } from '@/lib/levels';
import type { UserProfile } from '@/types/user';
import type { Mission } from '@/lib/levels';

export function useProgression() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const checkAndAdvanceKidLevel = useCallback(async () => {
    if (!user) return;
    
    const userDocRef = doc(firestore, 'users', user.uid);

    try {
        const userDocSnapshot = await getDoc(userDocRef);
        if (!userDocSnapshot.exists()) return;
        
        const userProfile = userDocSnapshot.data() as UserProfile;
        const currentKidLevel = userProfile.kid_level || 1;
        const missionsForCurrentLevel = KID_LEVELS_CONFIG[currentKidLevel]?.filter(m => typeof m !== 'string') as Mission[];

        if (!missionsForCurrentLevel || missionsForCurrentLevel.length === 0) {
            return;
        }

        const currentLevelProgress = userProfile.levelProgress?.[`KidLevel${currentKidLevel}`] || {};
        
        const allMissionsCompleted = missionsForCurrentLevel.every(mission => {
            const missionKey = `${mission.game.replace(/\s+/g, '')}-${mission.level}`;
            return currentLevelProgress[missionKey] === true;
        });

        if (allMissionsCompleted) {
            const nextKidLevel = currentKidLevel + 1;
            if (KID_LEVELS_CONFIG[nextKidLevel]) {
                await updateDoc(userDocRef, {
                    kid_level: nextKidLevel,
                });
                toast({
                    title: 'Kid Level Up!',
                    description: `Congratulations! You've unlocked Kid Level ${nextKidLevel}!`,
                });
            } else {
                 toast({
                    title: 'All Levels Complete!',
                    description: "You've mastered all the challenges in AttenWell!",
                });
            }
        }
    } catch (error) {
        console.error("Error checking or advancing kid level:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not check for level advancement.',
        });
    }

  }, [user, firestore, toast]);

  return { checkAndAdvanceKidLevel };
}
