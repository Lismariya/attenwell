
export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  age: number;
  dateJoined: string;
  progressLastResetAt?: string;
  coin: number;
  kid_level: number;
  mpin: string;
  gender: 'male' | 'female';
  avatarUrl: string;
  dailyPlayTimeLimit: number; // in minutes
  playTimeSpentToday: number; // in seconds
  playTimeLastResetDate: string; // YYYY-MM-DD
  cycleProgress?: {
    'noise-ninjas'?: boolean;
    'track-the-ball'?: boolean;
    'catch-the-right-one'?: boolean;
    'memory-match'?: boolean;
    'hit-the-monster'?: boolean;
    'jigsaw-puzzle'?: boolean;
    'meditation'?: boolean;
    'focus-session'?: boolean;
  };
  levelProgress?: {
    [kidLevelKey: string]: {
        [missionKey: string]: boolean;
    };
  };
  gameProgress: {
    'noise-ninjas': number;
    'track-the-ball': number;
    'catch-the-right-one': number;
    'memory-match': number;
    'hit-the-monster': number;
    'jigsaw-puzzle': number;
  };
};

export type WeeklyProgress = {
  id?: string;
  weekId: string;
  timestamp: any; // Firestore server timestamp
  attention: number;
  working_memory: number;
  inhibitory_control: number;
  problem_solving: number;
};
