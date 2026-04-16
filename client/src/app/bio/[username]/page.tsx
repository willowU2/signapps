"use client";

import { use, useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { ExternalLink } from "lucide-react";

const STORAGE_KEY = "signapps_link_in_bio";

interface BioLink {
  id: string;
  title: string;
  url: string;
  icon: string;
  color: string;
}

interface BioProfile {
  username: string;
  name: string;
  bio: string;
  avatar: string;
  links: BioLink[];
}

function loadProfile(): BioProfile | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
}

export default function BioPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  // Next.js 15+ — params is a Promise and must be unwrapped with React's `use`.
  const { username } = use(params);
  usePageTitle(`@${username}`);
  const [profile, setProfile] = useState<BioProfile | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const p = loadProfile();
    if (!p || p.username !== username) {
      setNotFound(true);
    } else {
      setProfile(p);
    }
  }, [username]);

  if (notFound) {
    return (
      <main
        id="main-content"
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800"
      >
        <div className="text-center">
          <p className="text-6xl mb-4" aria-hidden="true">
            🔍
          </p>
          <h1 className="text-2xl font-bold mb-2">Page not found</h1>
          <p className="text-muted-foreground">@{username} does not exist</p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main
        id="main-content"
        className="min-h-screen flex items-center justify-center"
      >
        <div
          className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"
          role="status"
          aria-label="Chargement du profil"
        />
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 p-4"
    >
      <div className="w-full max-w-sm">
        {/* Avatar & info */}
        <div className="flex flex-col items-center mb-6">
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar}
              alt={profile.name}
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
              {profile.name ? profile.name.charAt(0).toUpperCase() : "?"}
            </div>
          )}
          <h1 className="text-2xl font-bold mt-3">{profile.name}</h1>
          {profile.username && (
            <p className="text-muted-foreground text-sm">@{profile.username}</p>
          )}
          {profile.bio && (
            <p className="text-center mt-2 text-sm text-muted-foreground max-w-xs leading-relaxed">
              {profile.bio}
            </p>
          )}
        </div>

        {/* Links */}
        <div className="space-y-3">
          {profile.links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full py-3.5 px-5 rounded-2xl text-white font-semibold text-sm shadow-md hover:opacity-90 hover:scale-[1.02] active:scale-[0.99] transition-all"
              style={{ backgroundColor: link.color }}
            >
              <span className="text-lg">{link.icon}</span>
              <span className="flex-1 text-center">{link.title}</span>
              <ExternalLink className="w-4 h-4 opacity-70" />
            </a>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Powered by{" "}
          <a href="/" className="underline hover:text-foreground">
            SignApps
          </a>
        </p>
      </div>
    </main>
  );
}
