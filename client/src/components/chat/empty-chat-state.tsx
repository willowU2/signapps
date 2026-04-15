"use client";

export function EmptyChatState() {
  return (
    <div className="flex h-full items-center justify-center flex-col bg-background">
      <div className="w-64 h-64 flex items-center justify-center relative mb-6">
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-muted-foreground"
        >
          <path
            d="M120 150H80C50 150 40 140 40 110V80C40 50 50 40 80 40H110V20L150 50V110C150 140 140 150 120 150Z"
            className="fill-muted stroke-border"
            strokeWidth="2"
          />
          <path
            d="M140 120H100C80 120 70 110 70 90V60H110C130 60 140 70 140 90V120Z"
            className="fill-background stroke-border"
            strokeWidth="2"
          />
          <rect
            x="85"
            y="75"
            width="40"
            height="4"
            rx="2"
            className="fill-muted-foreground/30"
          />
          <rect
            x="85"
            y="85"
            width="30"
            height="4"
            rx="2"
            className="fill-muted-foreground/30"
          />
          <path d="M110 160L90 140H130L110 160Z" className="fill-border" />
          <circle cx="105" cy="110" r="16" className="fill-destructive/10" />
          <circle cx="105" cy="110" r="8" className="fill-destructive" />
        </svg>
      </div>
      <span className="text-[22px] font-normal text-foreground mb-2">
        Aucune conversation sélectionnée
      </span>
      <span className="text-sm text-muted-foreground">
        Sélectionnez une conversation dans le panneau latéral.
      </span>
    </div>
  );
}
