import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="rounded-full bg-muted p-4 mb-6">
        <FileQuestion className="h-10 w-10 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold mb-2">Page introuvable</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        Cette page n&apos;existe pas ou a ete deplacee.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <Link href="/admin/org-structure">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Link>
        </Button>
        <Button asChild>
          <Link href="/dashboard">
            <Home className="h-4 w-4 mr-2" />
            Tableau de bord
          </Link>
        </Button>
      </div>
    </div>
  );
}
