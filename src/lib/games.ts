
import { Ear, Eye, Hand, Puzzle, LayoutGrid, Hammer } from "lucide-react";
import { StaticImport } from "next/dist/shared/lib/get-img-props";

export type Game = {
  title: string;
  description: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  imageUrl?: string | StaticImport;
};

export const games: Game[] = [
  {
    title: "Noise Ninjas",
    description: "Improve focus by identifying sounds amidst background noise.",
    href: "/noise-ninjas",
    icon: Ear,
    imageUrl: "https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/noise_icon.jpg?alt=media&token=f91b36a4-7154-4856-9ad2-8709e13d9366",
  },
  {
    title: "Track the Ball",
    description: "Enhance attention by following a moving ball.",
    href: "/track-the-ball",
    icon: Eye,
    imageUrl: "https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/track_icon.jpg?alt=media&token=11056ea4-aec6-4754-be42-9cc754f5a584",
  },
  {
    title: "Catch the Right One",
    description: "Improve concentration by catching the correct target.",
    href: "/catch-the-right-one",
    icon: Hand,
    imageUrl: "https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/catch.jpg?alt=media&token=7112c6c7-85bf-49ea-8c7f-1ab0bc729759",
  },
  {
    title: "Memory Match",
    description: "Boost memory by matching pairs of cards.",
    href: "/memory-match",
    icon: Puzzle,
    imageUrl: "https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/memory.jpg?alt=media&token=7c00b2ea-6834-4206-a0a1-5303cb435653",
  },
  {
    title: "Hit the Monster",
    description: "Improve reaction time by tapping appearing monsters.",
    href: "/hit-the-monster",
    icon: Hammer,
    imageUrl: "https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/monster.jpg?alt=media&token=d215d467-edd4-431d-9c16-b2474175ce73",
  },
  {
    title: "Jigsaw Puzzle",
    description: "Improve problem-solving by completing puzzles.",
    href: "/jigsaw-puzzle",
    icon: LayoutGrid,
    imageUrl: "https://firebasestorage.googleapis.com/v0/b/cloudencrypt-54602.appspot.com/o/jigsaw.jpg?alt=media&token=75a7270b-a350-4912-92ed-5c360572e4b8",
  },
];
