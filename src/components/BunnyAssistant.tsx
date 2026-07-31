'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { X, ArrowRight } from 'lucide-react';

type MissionInfo = {
    name: string;
    description: string;
    href: string;
    icon: React.ElementType;
};

type BunnyAssistantProps = {
    mission: MissionInfo | null;
    onClose: () => void;
};

export function BunnyAssistant({ mission, onClose }: BunnyAssistantProps) {
    if (!mission) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-center animate-in fade-in duration-500">
            {/* Speech Bubble */}
            <div className="relative bg-white p-4 rounded-2xl shadow-lg max-w-xs z-10">
                 <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    aria-label="Close suggestion"
                >
                    <X className="h-4 w-4" />
                </button>
                <p className="font-bold text-lg mb-2">Hey there!</p>
                <p className="text-sm text-gray-600 mb-3">
                    Looks like your next adventure is{' '}
                    <span className="font-semibold text-primary">{mission.name}</span>. Ready to play?
                </p>
                <Link href={mission.href} passHref>
                    <Button className="w-full">
                        Let's Go!
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </Link>
            </div>

            {/* Bunny Image */}
            <div className="relative w-64 h-[20rem] md:w-[25rem] md:h-[32.5rem] md:-mt-16">
                 <Image
                    src="/images/bunny.png"
                    alt="Bunny Assistant"
                    fill
                    style={{ objectFit: 'contain', objectPosition: 'bottom' }}
                />
            </div>
        </div>
    );
}
