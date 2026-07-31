
'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';

const assetsToPreload = [
  // Audio files
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/bgm.mp3?alt=media&token=8faa92eb-4f87-4051-92e2-270441479790',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/coin.mp3?alt=media&token=96b565f8-b34d-4589-9bab-97a7491d9abd',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/rock.mp3?alt=media&token=ac31fd43-e78f-43fc-9c1a-915c4d24055d',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/explode.mp3?alt=media&token=632da777-12fc-4440-a202-808096fba56a',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/crowd-cheering-383111.mp3?alt=media&token=ebc76a39-6400-4b39-ac6a-f7d437f07744',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/slap.mp3?alt=media&token=4a19ced6-6687-40da-bd41-36aeb687069a',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/hammer-smash-effect-382731.mp3?alt=media&token=3573b478-497e-43e5-9d41-2dcab6a49a3f',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/ghost.mp3?alt=media&token=a607f14a-5544-4f45-803f-8313a7c16fd9',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/ooh-4-82986.mp3?alt=media&token=048c3cdf-5bef-4546-8b8e-3fbe26021204',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/card-sounds-35956.mp3?alt=media&token=c135cab6-55a4-4297-bd14-3d57c66f7b0f',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/select-menu-47560.mp3?alt=media&token=7eacb2d1-6bf3-4998-8435-ab614b0754ff',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/man-says-amazing-184036.mp3?alt=media&token=d35f458f-5eaf-4279-b2f8-6c0fc873effb',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/park.mp3?alt=media&token=79b99e6b-0e2f-40e8-a6cb-cc2ec49ee5cb',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/dog.mp3?alt=media&token=9bf89f9c-3695-4ae5-bf8a-6aa49d894992',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/cat.mp3?alt=media&token=f5915cb6-61bd-45eb-88f7-0d3e0ca3eda3',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/chimes.mp3?alt=media&token=77df89f2-0065-4828-b850-ff51b3ba6edb',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/collission.mp3?alt=media&token=ade6c6ef-0eb9-4f69-a9d4-5d2e383a1d6f',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/right.mp3?alt=media&token=fcf2236d-dcd2-480f-993d-faca1a85b20a',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/beep-329314.mp3?alt=media&token=3810d1a8-92bd-4158-97a9-cd9e5dc8ef54',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/end_alert.mp3?alt=media&token=0b674b88-469b-44f2-984e-2895a9d68249',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/2min.mp3?alt=media&token=23b9b427-786d-4085-a320-b7d44c68b4ad',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/5.mp3?alt=media&token=1f981ed7-2498-4084-87c0-c39df072a575',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/10.mp3?alt=media&token=ae20e8bc-6566-47c2-a055-090df494f7f4',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/15.mp3?alt=media&token=13d9b2af-227f-420a-ab52-f94c7ab61688',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/20.mp3?alt=media&token=ab117b61-19d6-4677-8066-e64542df15c7',
  // Image files
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/background.jpg?alt=media&token=07a15431-c6f1-4bfd-94d9-141e6d3b8ea1',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/noise_icon.jpg?alt=media&token=f91b36a4-7154-4856-9ad2-8709e13d9366',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/track_icon.jpg?alt=media&token=11056ea4-aec6-4754-be42-9cc754f5a584',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/catch.jpg?alt=media&token=7112c6c7-85bf-49ea-8c7f-1ab0bc729759',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/memory.jpg?alt=media&token=7c00b2ea-6834-4206-a0a1-5303cb435653',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/monster.jpg?alt=media&token=d215d467-edd4-431d-9c16-b2474175ce73',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/jigsaw.jpg?alt=media&token=75a7270b-a350-4912-92ed-5c360572e4b8',
  'https://cdn.pixabay.com/photo/2022/08/27/12/02/dragon-7414336_1280.jpg',
  'https://cdn.pixabay.com/photo/2024/04/20/14/40/ai-generated-8708710_1280.jpg',
  'https://cdn.pixabay.com/photo/2025/11/20/01/16/penguin-9966285_1280.jpg',
  'https://cdn.pixabay.com/photo/2018/12/23/09/45/toy-3890797_1280.jpg',
  'https://i.postimg.cc/W1w33ZQv/meditation.jpg',
  'https://i.postimg.cc/v8KXqg2Q/focus.jpg',
  'https://i.postimg.cc/x8c4qBgv/game.jpg',
  'https://i.postimg.cc/QdsvJYdR/parents.jpg',
  'https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/meditation.jpg?alt=media&token=72dc1a54-a0bb-4bea-9264-57d6897fa30e',
];

const loadingMessages = [
    "Setting up engines...",
    "Downloading requirements...",
    "Calibrating cognitive boosters...",
    "Loading fun...",
    "Finalizing...",
];


export default function SplashScreen() {
  const router = useRouter();
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);

  useEffect(() => {
    const messageInterval = setInterval(() => {
        setLoadingMessage(prev => {
            const currentIndex = loadingMessages.indexOf(prev);
            const nextIndex = (currentIndex + 1) % loadingMessages.length;
            return loadingMessages[nextIndex];
        });
    }, 2000);

    const minimumDisplayTime = 3000;
    const startTime = Date.now();

    const preloadAssets = () => {
        const promises = assetsToPreload.map(src => {
            return new Promise((resolve, reject) => {
                if (src.match(/\.(mp3|wav|ogg)$/)) {
                    const audio = new Audio();
                    audio.src = src;
                    audio.oncanplaythrough = () => resolve(src);
                    audio.onerror = () => reject(src);
                } else if (src.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
                    const img = new window.Image();
                    img.src = src;
                    img.onload = () => resolve(src);
                    img.onerror = () => reject(src);
                } else {
                    resolve(src); // Not an asset we can preload this way
                }
            });
        });
        return Promise.allSettled(promises);
    };

    preloadAssets().then(() => {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = minimumDisplayTime - elapsedTime;

        setTimeout(() => {
            router.push('/welcome');
        }, Math.max(0, remainingTime));
    });

    return () => {
      clearInterval(messageInterval);
    };
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4" style={{ backgroundColor: '#F3F4F3' }}>
      <div className="flex flex-col items-center gap-4">
        <Image 
            src="/images/attenwell.jpeg"
            alt="AttenWell Logo" 
            width={256} 
            height={256}
            priority
            className="rounded-lg"
            onLoad={() => setLogoLoaded(true)}
        />
      </div>
      {logoLoaded && (
        <div className="absolute bottom-20 flex flex-col items-center gap-2 animate-in fade-in duration-500">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{loadingMessage}</p>
        </div>
      )}
    </div>
  );
}
