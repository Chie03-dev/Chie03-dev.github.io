"use client";

import { useState, useCallback } from "react";

interface LifeCardData {
  hobbies: string[];
  dailyRoutine?: { time: string; activity: string }[];
  background: string[];
  dos: string[];
  donts: string[];
}

const LIFE_DATA: LifeCardData = {
  hobbies: [
    "Building mechanical keyboards",
    "Reading sci-fi & tech philosophy",
    "Indie game development",
    "Urban photography",
    "Specialty coffee brewing",
    "Learning human languages (currently: Japanese)",
  ],
  background: [
    "Started coding at 12 with GameMaker â†’ fell in love with systems",
    "CS degree + 8 years shipping products at startups & scale-ups",
    "Led mobile/platform teams; built offline-first sync engines",
    "Obsessed with developer experience, local-first software, and craft",
    "Now: Staff Engineer building tools developers actually enjoy using",
  ],
  dos: [
    "Write code for humans first, machines second",
    "Default to simplicity; complexity is a liability",
    "Document decisions, not just implementations",
    "Invest in tooling that compounds team velocity",
    "Give credit generously; take ownership of failures",
    "Build for the 90% case, extend for the 10%",
  ],
  donts: [
    "Don't optimize prematurely measure first",
    "Don't gatekeep knowledge; share context freely",
    "Don't ship broken windows fix it now or flag it",
    "Don't conflate velocity with value",
    "Don't ignore friction in developer workflows",
    "Don't let perfect be the enemy of shipped",
  ],
};

interface Card {
  id: string;
  title: string;
  icon: React.ReactNode;
  render: () => React.ReactNode;
}

const ICONS = {
  hobby: (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  background: (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <polyline points="9 2 13 2 13 5 9 5 9 2" />
    </svg>
  ),
  check: (
    <svg className="size-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  x: (
    <svg className="size-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};
function HobbyTags({ hobbies }: { hobbies: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {hobbies.map((hobby) => (
        <span key={hobby} className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm text-foreground transition hover:border-primary/40 hover:bg-primary/5">
          {hobby}
        </span>
      ))}
    </div>
  );
}

function BackgroundList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, idx) => (
        <li key={idx} className="flex gap-3 text-sm leading-relaxed">
          <span className="mt-1 h-4 w-4 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-primary">{idx + 1}</span>
          </span>
          <span className="text-muted-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DoDontList({ items, icon }: { items: string[]; icon: React.ReactNode }) {
  return (
    <ul className="space-y-3">
      {items.map((item, idx) => (
        <li key={idx} className="flex gap-3 text-sm leading-relaxed">
          <span className="shrink-0">{icon}</span>
          <span className="text-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function CardContent({ card }: { card: Card }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-6 transition hover:border-primary/30 h-[360px] flex flex-col shadow-lg backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-3 shrink-0">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{card.icon}</span>
        <h3 className="text-lg font-semibold text-foreground">{card.title}</h3>
      </div>
      <div className="flex-1 overflow-y-auto pr-1">{card.render()}</div>
    </div>
  );
}


export function LifeCard() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const cards: Card[] = [
    {
      id: "hobbies",
      title: "Hobbies & Interests",
      icon: ICONS.hobby,
      render: () => <HobbyTags hobbies={LIFE_DATA.hobbies} />,
    },
    {
      id: "background",
      title: "Background",
      icon: ICONS.background,
      render: () => <BackgroundList items={LIFE_DATA.background} />,
    },
    {
      id: "dos",
      title: "Do's",
      icon: ICONS.check,
      render: () => <DoDontList items={LIFE_DATA.dos} icon={ICONS.check} />,
    },
    {
      id: "donts",
      title: "Don'ts",
      icon: ICONS.x,
      render: () => <DoDontList items={LIFE_DATA.donts} icon={ICONS.x} />,
    },
  ];

  const goTo = useCallback((index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, cards.length - 1)));
  }, [cards.length]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const midX = rect.width / 2;
    if (clickX < midX) {
      goTo(currentIndex - 1);
    } else {
      goTo(currentIndex + 1);
    }
  }, [currentIndex, goTo]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goTo(currentIndex - 1);
    if (e.key === "ArrowRight") goTo(currentIndex + 1);
  }, [currentIndex, goTo]);

  return (
    <div className="relative flex min-h-[480px] items-center justify-center">
      <div
              className="relative w-full max-w-md h-[400px] perspective-[1000px] cursor-pointer"
            role="region"
            aria-label="Life cards stack"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            {cards.map((card, index) => {
              const distance = index - currentIndex;
              const absDistance = Math.abs(distance);
              const isActive = distance === 0;
              const isPrevious = distance < 0;
              const isNext = distance > 0;

              let transform = "";
              let zIndex = cards.length - absDistance;
              let opacity = 1;
              let scale = 1;
              let rotateY = 0;
              let translateX = 0;
              let translateY = 0;
              let filter = "none";

              if (isActive) {
                transform = "translateZ(0) rotateY(0deg) scale(1)";
                zIndex = cards.length + 10;
                opacity = 1;
                scale = 1;
              } else if (isPrevious) {
                const offset = absDistance;
                translateX = -30 * offset;
                translateY = 12 * offset;
                rotateY = 10 * offset;
                scale = 0.9 - 0.03 * offset;
                opacity = 0.6 - 0.15 * offset;
                zIndex = cards.length - offset;
                filter = `blur(${1 * offset}px)`;
                transform = `translateX(${translateX}px) translateY(${translateY}px) rotateY(${rotateY}deg) scale(${scale})`;
              } else if (isNext) {
                const offset = absDistance;
                translateX = 30 * offset;
                translateY = 12 * offset;
                rotateY = -10 * offset;
                scale = 0.9 - 0.03 * offset;
                opacity = 0.6 - 0.15 * offset;
                zIndex = cards.length - offset;
                filter = `blur(${1 * offset}px)`;
                transform = `translateX(${translateX}px) translateY(${translateY}px) rotateY(${rotateY}deg) scale(${scale})`;
              }

              return (
                <div
                  key={card.id}
                  className="absolute inset-x-0 top-0 transition-all duration-500 ease-out"
                  style={{
                    transform,
                    zIndex,
                    opacity: absDistance > 2 ? 0 : opacity,
                    filter,
                    pointerEvents: isActive ? "auto" : "none",
                  }}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${card.title}, card ${index + 1} of ${cards.length}`}
                  aria-current={isActive ? "true" : "false"}
                >
                  <CardContent card={card} />
                </div>
              );
            })}

            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-1.5" aria-hidden="true">
              {cards.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                    i === currentIndex
                      ? "bg-primary w-6"
                      : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
  );
}
