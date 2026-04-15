import { memo } from "react";
import { MousePointer2 } from "lucide-react";

export interface CollaboratorState {
  user?: {
    name: string;
    color: string;
  };
  cursor?: {
    x: number;
    y: number;
    slideId: string;
  };
}

interface CursorOverlayProps {
  collaborators: Record<number, CollaboratorState>;
  activeSlideId: string | null;
}

export const CursorOverlay = memo(function CursorOverlay({
  collaborators,
  activeSlideId,
}: CursorOverlayProps) {
  if (!activeSlideId) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {Object.entries(collaborators).map(([clientId, state]) => {
        const { user, cursor } = state;

        // Don't render if the user hasn't moved their cursor yet, or if they are on a different slide
        if (!cursor || !user || cursor.slideId !== activeSlideId) {
          return null;
        }

        return (
          <div
            key={clientId}
            className="absolute top-0 left-0 transition-all duration-150 ease-linear pointer-events-none flex flex-col items-start"
            style={{
              transform: `translate(${cursor.x}px, ${cursor.y}px)`,
            }}
          >
            {/* Cursor SVG */}
            <MousePointer2
              className="w-5 h-5 -mt-1 -ml-1 fill-current drop-shadow-md"
              style={{ color: user.color, stroke: "white", strokeWidth: 2 }}
            />

            {/* Name Tag */}
            <div
              className="px-2 py-0.5 rounded text-xs font-semibold text-white whitespace-nowrap shadow-sm mt-1 ml-3"
              style={{ backgroundColor: user.color }}
            >
              {user.name}
            </div>
          </div>
        );
      })}
    </div>
  );
});
