

'use client';

import { GameCard } from '@/components/game-card';
import { games } from '@/lib/games';
import { Header } from '@/components/header';

export default function GamesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <section className="py-8">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 gap-4">
              {games.map((game) => (
                <GameCard 
                  key={game.href} 
                  game={game} 
                />
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="text-center p-4 text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} AttenWell. All rights reserved.</p>
      </footer>
    </div>
  );
}
