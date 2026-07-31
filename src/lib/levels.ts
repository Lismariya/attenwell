
import type { UserProfile } from '@/types/user';

export type Mission = {
  game: string;
  level: number;
};

export type KidLevelConfig = {
  [key: number]: (Mission | string)[];
};

export const KID_LEVELS_CONFIG: KidLevelConfig = {
  1: [
    { game: 'Noise Ninjas', level: 1 },
    { game: 'Track the Ball', level: 1 },
    { game: 'Hit the Monster', level: 1 },
    { game: 'Memory Match', level: 1 },
    { game: 'Jigsaw Puzzle', level: 1 },
    { game: 'Catch the Right One', level: 1 },
  ],
  2: [
    { game: 'Noise Ninjas', level: 2 },
    { game: 'Noise Ninjas', level: 3 },
    { game: 'Track the Ball', level: 2 },
    { game: 'Track the Ball', level: 3 },
    { game: 'Hit the Monster', level: 2 },
    { game: 'Hit the Monster', level: 3 },
    { game: 'Memory Match', level: 2 },
    { game: 'Memory Match', level: 3 },
    { game: 'Jigsaw Puzzle', level: 2 },
    { game: 'Jigsaw Puzzle', level: 3 },
    { game: 'Catch the Right One', level: 2 },
    { game: 'Catch the Right One', level: 3 },
  ],
  3: [
    { game: 'Noise Ninjas', level: 4 },
    { game: 'Noise Ninjas', level: 5 },
    { game: 'Noise Ninjas', level: 6 },
    { game: 'Track the Ball', level: 4 },
    { game: 'Track the Ball', level: 5 },
    { game: 'Track the Ball', level: 6 },
    { game: 'Hit the Monster', level: 4 },
    { game: 'Hit the Monster', level: 5 },
    { game: 'Hit the Monster', level: 6 },
    { game: 'Memory Match', level: 4 },
    { game: 'Memory Match', level: 5 },
    { game: 'Memory Match', level: 6 },
    { game: 'Jigsaw Puzzle', level: 4 },
    { game: 'Jigsaw Puzzle', level: 5 },
    { game: 'Jigsaw Puzzle', level: 6 },
    { game: 'Catch the Right One', level: 4 },
    { game: 'Catch the Right One', level: 5 },
    { game: 'Catch the Right One', level: 6 },
  ],
  4: [
    { game: 'Noise Ninjas', level: 7 },
    { game: 'Noise Ninjas', level: 8 },
    { game: 'Noise Ninjas', level: 9 },
    { game: 'Noise Ninjas', level: 10 },
    { game: 'Track the Ball', level: 7 },
    { game: 'Track the Ball', level: 8 },
    { game: 'Track the Ball', level: 9 },
    { game: 'Track the Ball', level: 10 },
    { game: 'Hit the Monster', level: 7 },
    { game: 'Hit the Monster', level: 8 },
    { game: 'Hit the Monster', level: 9 },
    { game: 'Hit the Monster', level: 10 },
    { game: 'Memory Match', level: 7 },
    { game: 'Memory Match', level: 8 },
    { game: 'Memory Match', level: 9 },
    { game: 'Memory Match', level: 10 },
    { game: 'Jigsaw Puzzle', level: 7 },
    { game: 'Jigsaw Puzzle', level: 8 },
    { game: 'Jigsaw Puzzle', level: 9 },
    { game: 'Jigsaw Puzzle', level: 10 },
    { game: 'Catch the Right One', level: 7 },
    { game: 'Catch the Right One', level: 8 },
    { game: 'Catch the Right One', level: 9 },
    { game: 'Catch the Right One', level: 10 },
  ]
};

export function isLevelUnlocked(userProfile: UserProfile | null | undefined, gameTitle: string, level: number): boolean {
  if (!userProfile) return false;

  const kidLevel = userProfile.kid_level || 1;
  const missionsForKidLevel = KID_LEVELS_CONFIG[kidLevel]?.filter(m => typeof m !== 'string') as Mission[];
  if (!missionsForKidLevel) return false;

  const gameMissions = missionsForKidLevel.filter(m => m.game === gameTitle);
  if (gameMissions.length === 0) return true; // Game not in this kid level, so no restrictions from this system.

  const firstLevelForGameInCycle = Math.min(...gameMissions.map(m => m.level));

  if (level < firstLevelForGameInCycle) return true; // Assume previous kid levels are completed
  if (level > Math.max(...gameMissions.map(m => m.level))) return false; // Level is beyond current kid level scope

  // if it's the first level in the cycle, it's unlocked.
  if (level === firstLevelForGameInCycle) {
    return true;
  }

  // For subsequent levels, check if the previous one is complete
  const levelProgress = userProfile.levelProgress?.[`KidLevel${kidLevel}`] || {};
  const prevMissionKey = `${gameTitle.replace(/\s+/g, '')}-${level - 1}`;

  return levelProgress[prevMissionKey] === true;
};


export function getNextMission(userProfile: UserProfile | null | undefined, currentGameTitle: string): Mission | null {
    if (!userProfile) return null;
    
    const kidLevel = userProfile.kid_level || 1;
    const missionsForKidLevel = KID_LEVELS_CONFIG[kidLevel]?.filter(m => typeof m !== 'string') as Mission[];
    if (!missionsForKidLevel) return null;

    const levelProgress = userProfile.levelProgress?.[`KidLevel${kidLevel}`] || {};

    // First, try to find the next mission within the current game context if provided
    if (currentGameTitle) {
        const gameMissions = missionsForKidLevel.filter(m => m.game === currentGameTitle).sort((a,b) => a.level - b.level);

        for (const mission of gameMissions) {
            const missionKey = `${mission.game.replace(/\s+/g, '')}-${mission.level}`;
            if (!levelProgress[missionKey]) {
                return mission; // Return the next available mission object for this game
            }
        }
    }

    // If no specific game context, or if the current game is finished for this kid level, find the absolute next mission from the top.
    for (const mission of missionsForKidLevel) {
        const missionKey = `${mission.game.replace(/\s+/g, '')}-${mission.level}`;
        if (!levelProgress[missionKey]) {
            // This is the first uncompleted mission in the list.
            return mission;
        }
    }

    // If all game missions are completed for the current kid level.
    return null;
};
