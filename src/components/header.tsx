
import Link from 'next/link';
import Image from 'next/image';

export function Header() {
  return (
    <header className="p-4" style={{ backgroundColor: '#F3F4F4' }}>
      <div className="container mx-auto flex items-center justify-center">
        <Link href="/home" className="flex items-center gap-2 text-primary">
          <Image
            src="/images/attenwell.jpeg"
            alt="AttenWell Logo"
            width={120}
            height={120}
            className="rounded-lg"
          />
        </Link>
      </div>
    </header>
  );
}
