import { HardHat } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface UnderConstructionProps {
    title: string;
    description: string;
}

export function UnderConstruction({ title, description }: UnderConstructionProps) {
    return (
        <AppLayout>
            <div className="flex h-full flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 mb-8">
                    <HardHat className="h-12 w-12 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-4">{title}</h1>
                <p className="text-muted-foreground max-w-lg mb-8">
                    {description}
                </p>
                <Link href="/dashboard">
                    <Button variant="default" size="lg">
                        Retour au Dashboard
                    </Button>
                </Link>
            </div>
        </AppLayout>
    );
}
