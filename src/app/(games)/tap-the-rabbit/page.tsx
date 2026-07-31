
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Rabbit } from 'lucide-react';

export default function TapTheRabbitPage() {

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit mb-2">
          <Rabbit className="h-6 w-6 md:h-8 md:w-8" />
        </div>
        <CardTitle className="text-2xl md:text-3xl font-headline">
          New Game
        </CardTitle>
        <CardDescription>
          Ready to be built!
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-6 p-4 md:p-12 min-h-[400px]">
        <p className="text-muted-foreground">This space is ready for your new game idea.</p>
      </CardContent>
    </Card>
  );
}
