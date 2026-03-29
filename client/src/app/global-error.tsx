"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertOctagon, RefreshCw } from "lucide-react";
import "./globals.css"; // Ensure styles are loaded if possible, though this replaces root layout

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.debug("Global error:", error);
    }, [error]);

    return (
        <html lang="en">
            <body>
                <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground">
                    <div className="text-center space-y-6 max-w-md">
                        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10">
                            <AlertOctagon className="h-12 w-12 text-destructive" />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold">Erreur critique</h1>
                            <p className="text-muted-foreground">
                                L'application a rencontré une erreur critique et ne peut pas continuer.
                            </p>
                        </div>
                        <Button onClick={() => reset()} className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Relancer l'application
                        </Button>
                    </div>
                </div>
            </body>
        </html>
    );
}
