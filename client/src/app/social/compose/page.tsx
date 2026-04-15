"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { PostComposer } from "@/components/social/post-composer";
import { Suspense } from "react";
import { usePageTitle } from "@/hooks/use-page-title";

function ComposeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialContent = searchParams.get("content") ?? "";

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Compose Post</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create and publish to your connected social accounts
        </p>
      </div>
      <PostComposer
        initialContent={initialContent}
        onSaved={() => router.push("/social")}
      />
    </div>
  );
}

export default function ComposePage() {
  usePageTitle("Composer");
  return (
    <Suspense>
      <ComposeContent />
    </Suspense>
  );
}
