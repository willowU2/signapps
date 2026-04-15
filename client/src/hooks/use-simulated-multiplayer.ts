import { useState, useEffect } from "react";

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  activeSlideId?: string; // If null, means they are just on the document globally
}

const SIMULATED_USERS = [
  { id: "guest-1", name: "Alice", color: "#ec4899" }, // Pink
  { id: "guest-2", name: "Bob", color: "#3b82f6" }, // Blue
];

/**
 * Hook to simulate real-time multiplayer presence (cursors moving randomly)
 * @param activeSlideId The current slide/page ID to bound the cursors to.
 * @param enabled Whether the simulation is running.
 */
export function useSimulatedMultiplayer(
  activeSlideId: string | null = null,
  enabled: boolean = true,
) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  useEffect(() => {
    if (!enabled) return;

    // Initialize guests
    const initialGuests: Collaborator[] = SIMULATED_USERS.map((user) => ({
      ...user,
      cursor: null,
      activeSlideId: activeSlideId || "document",
    }));

    setCollaborators(initialGuests);

    // Simulation Loop
    const intervalId = setInterval(() => {
      setCollaborators((currentCollabs) => {
        return currentCollabs.map((collab) => {
          // Randomly decide if this user moves this tick (throttle movements to seem realistic)
          if (Math.random() > 0.4) {
            return collab; // Keep old position
          }

          // Generate a new random destination
          // within reasonable bounds of an A4 page (800x1000)
          const currentX = collab.cursor?.x || 200 + Math.random() * 400;
          const currentY = collab.cursor?.y || 200 + Math.random() * 600;

          // Smooth random walk
          const dx = (Math.random() - 0.5) * 150;
          const dy = (Math.random() - 0.5) * 150;

          const newX = Math.max(50, Math.min(750, currentX + dx));
          const newY = Math.max(50, Math.min(950, currentY + dy));

          return {
            ...collab,
            cursor: { x: newX, y: newY },
            activeSlideId: activeSlideId || "document",
          };
        });
      });
    }, 1200); // Update every 1.2s

    return () => clearInterval(intervalId);
  }, [enabled, activeSlideId]);

  return { collaborators };
}
