'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { XpSystemFull } from '@/components/gamification/XpSystemFull';
import { AchievementBadges } from '@/components/gamification/AchievementBadges';
import { ProductivityStreaks } from '@/components/gamification/ProductivityStreaks';
import { TeamLeaderboardFull } from '@/components/gamification/TeamLeaderboardFull';
import { FeatureDiscoveryChecklist } from '@/components/onboarding/FeatureDiscoveryChecklist';
import { Zap } from 'lucide-react';

export default function GamificationPage() {
  return (
    <AppLayout>
      <div className="w-full py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold">Progression & Gamification</h1>
            <p className="text-sm text-muted-foreground">Suivez votre progression et comparez-vous à votre équipe</p>
          </div>
        </div>

        <FeatureDiscoveryChecklist />

        <Tabs defaultValue="xp">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="xp">XP & Niveau</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
            <TabsTrigger value="streak">Streak</TabsTrigger>
            <TabsTrigger value="leaderboard">Classement</TabsTrigger>
          </TabsList>

          <TabsContent value="xp" className="mt-4">
            <div className="border rounded-xl overflow-hidden">
              <XpSystemFull />
            </div>
          </TabsContent>

          <TabsContent value="badges" className="mt-4">
            <div className="border rounded-xl overflow-hidden">
              <AchievementBadges />
            </div>
          </TabsContent>

          <TabsContent value="streak" className="mt-4">
            <div className="border rounded-xl overflow-hidden">
              <ProductivityStreaks />
            </div>
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-4">
            <div className="border rounded-xl overflow-hidden">
              <TeamLeaderboardFull />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
