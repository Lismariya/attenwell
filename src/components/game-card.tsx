
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import type { Game } from '@/lib/games';
import Image from 'next/image';

type GameCardProps = {
  game: Game;
};

export function GameCard({ game }: GameCardProps) {
  const Icon = game.icon;
  return (
    <Link href={game.href} className="block group">
      <Card className="h-full transition-all duration-300 ease-in-out hover:shadow-xl hover:border-primary active:scale-95 overflow-hidden">
        <CardContent className="flex flex-col items-center justify-center text-center p-0 aspect-square">
          <div className="relative w-full h-full">
            {game.imageUrl ? (
              <Image
                src={game.imageUrl}
                alt={game.title}
                fill
                className="object-cover"
              />
            ) : Icon ? (
              <div className="p-3 mb-2 rounded-full bg-primary/10 text-primary flex items-center justify-center h-full w-full">
                <Icon className="h-16 w-16" />
              </div>
            ) : null}
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2">
              <p className="font-headline text-sm font-semibold text-center text-white">
                {game.title}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
