"use client"

import { Button } from "@/components/ui/button"
import { Check, FileText, Globe, Mail } from "lucide-react"

export function MeetAiCard() {
    return (
        <div className="absolute top-4 right-4 z-20 w-[320px] bg-[#1f1f1f] rounded-2xl shadow-xl border border-[#3c4043] flex flex-col p-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-xl font-medium text-[#8ab4f8] leading-tight mb-8">
                Laissez l'Assistant IA prendre des notes pour cette réunion
            </h3>

            <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4 p-4 bg-[#28292a] rounded-xl border border-[#3c4043]">
                    <Mail className="h-5 w-5 text-[#9aa0a6] shrink-0 mt-0.5" />
                    <p className="text-sm text-[#e8eaed]">
                        Les notes seront envoyées aux invités de votre organisation
                    </p>
                </div>

                <div className="flex items-center p-4 bg-[#28292a] rounded-xl border border-[#3c4043]">
                    <Globe className="h-5 w-5 text-[#9aa0a6] shrink-0 mr-4" />
                    <p className="text-sm text-[#8ab4f8] cursor-pointer hover:underline">
                        Langue de la réunion : Français (alpha)
                    </p>
                </div>

                <div className="flex items-start gap-4 p-4 bg-[#28292a] rounded-xl border border-[#3c4043]">
                    <FileText className="h-5 w-5 text-[#9aa0a6] shrink-0 mt-0.5" />
                    <p className="text-sm text-[#e8eaed] text-[13px] leading-relaxed">
                        Les données collectées lors de cette réunion, y compris l'audio, seront utilisées et conservées temporairement pour créer des artefacts de la réunion.
                    </p>
                </div>

                <label className="flex items-center gap-4 p-4 bg-[#28292a] rounded-xl border border-[#3c4043] cursor-pointer">
                    <div className="h-5 w-5 bg-[#8ab4f8] rounded-[4px] flex items-center justify-center shrink-0">
                        <Check className="h-3.5 w-3.5 text-[#1f1f1f] stroke-[3]" />
                    </div>
                    <p className="text-sm text-[#e8eaed] select-none">
                        Démarrer aussi la transcription
                    </p>
                </label>
            </div>

            <Button variant="ghost" className="w-full text-[#e8eaed] bg-[#28292a] hover:bg-[#3c4043] rounded-full h-11 mb-4 flex justify-between items-center px-5 flex-row-reverse border border-[#3c4043]">
                <span className="text-sm font-medium mx-auto">Plus de paramètres</span>
                <span className="w-4 h-4" /> {/* Spacer for centering */}
            </Button>

            <Button className="w-full bg-[#c2e7ff] hover:bg-[#a8d3f1] text-[#001d35] rounded-full h-[52px] font-medium text-[15px] flex flex-col items-center justify-center leading-tight">
                <span>Commencer à prendre des notes</span>
                <span className="text-[13px] font-normal">(Français)</span>
            </Button>
        </div>
    )
}
