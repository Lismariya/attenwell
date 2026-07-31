
import { Header } from '@/components/header';
import { PlayTimeGuard } from '@/components/PlayTimeGuard';

export default function GamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto p-4">
        <PlayTimeGuard>
            {children}
        </PlayTimeGuard>
      </main>
    </div>
  );
}
