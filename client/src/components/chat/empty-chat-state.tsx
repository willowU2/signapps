"use client"

export function EmptyChatState() {
    return (
        <div className="flex h-full items-center justify-center flex-col bg-white">
            <div className="w-64 h-64 flex items-center justify-center relative mb-6">
                <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M120 150H80C50 150 40 140 40 110V80C40 50 50 40 80 40H110V20L150 50V110C150 140 140 150 120 150Z" fill="#F8F9FA" stroke="#DADCE0" strokeWidth="2"/>
                    <path d="M140 120H100C80 120 70 110 70 90V60H110C130 60 140 70 140 90V120Z" fill="white" stroke="#DADCE0" strokeWidth="2"/>
                    <rect x="85" y="75" width="40" height="4" rx="2" fill="#E8EAED"/>
                    <rect x="85" y="85" width="30" height="4" rx="2" fill="#E8EAED"/>
                    <path d="M110 160L90 140H130L110 160Z" fill="#DADCE0"/>
                    <circle cx="105" cy="110" r="16" fill="#FCE8E6"/>
                    <circle cx="105" cy="110" r="8" fill="#EA4335"/>
                </svg>
            </div>
            <span className="text-[22px] font-normal text-[#1f1f1f] mb-2">Aucune conversation sélectionnée</span>
            <span className="text-sm text-[#444746]">
                Sélectionnez une conversation dans le panneau latéral.
            </span>
        </div>
    )
}
