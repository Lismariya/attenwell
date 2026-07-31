'use client';
import { cn } from "@/lib/utils";
import React from "react";

export const GhostIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="120"
    height="120"
    viewBox="0 0 120 120"
    xmlns="http://www.w3.org/2000/svg"
    className={cn(className)}
    {...props}
  >
    <path
      d="M60 20C40 20 25 35 25 55V95C25 95 30 90 35 90C40 90 43 95 48 95C53 95 56 90 60 90C64 90 67 95 72 95C77 95 80 90 85 90C90 90 95 95 95 95V55C95 35 80 20 60 20Z"
      fill="white"
      stroke="black"
      strokeWidth="2"
    />
    <circle cx="45" cy="50" r="6" fill="black" />
    <circle cx="75" cy="50" r="6" fill="black" />
  </svg>
);

export const RabbitIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="120"
    height="120"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn(className)}
    {...props}
    >
    <ellipse cx="42" cy="35" rx="12" ry="28" fill="white" stroke="black" strokeWidth="2" transform="rotate(-15 42 35)" />
    <ellipse cx="42" cy="35" rx="6" ry="20" fill="#FFB6C1" transform="rotate(-15 42 35)" />
    
    <ellipse cx="78" cy="35" rx="12" ry="28" fill="white" stroke="black" strokeWidth="2" transform="rotate(15 78 35)" />
    <ellipse cx="78" cy="35" rx="6" ry="20" fill="#FFB6C1" transform="rotate(15 78 35)" />
    
    <circle cx="60" cy="70" r="28" fill="white" stroke="black" strokeWidth="2" />
    
    <circle cx="52" cy="66" r="3.5" fill="black" />
    
    <circle cx="68" cy="66" r="3.5" fill="black" />

    <ellipse cx="60" cy="75" rx="4" ry="3" fill="#FF8FA3" />
    <line x1="60" y1="75" x2="60" y2="79" stroke="black" strokeWidth="1.5" strokeLinecap="round" />
    
    <path d="M52 79 Q60 84 68 79" stroke="black" strokeWidth="2" strokeLinecap="round" fill="none" />
    
    <circle cx="45" cy="75" r="6" fill="#FFB6C1" opacity="0.6" />
    
    <circle cx="75" cy="75" r="6" fill="#FFB6C1" opacity="0.6" />
  </svg>
);
