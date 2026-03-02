import React from "react"
import { Search, SlidersHorizontal, Menu, HelpCircle, Settings, Grid } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function MailHeader() {
    return (
        <header className="h-16 shrink-0 flex items-center justify-between px-4 pr-6">
            <div className="flex items-center gap-4 w-[260px] shrink-0 relative z-20">
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full text-[#444746] dark:text-[#e3e3e3] hover:bg-gray-100 dark:hover:bg-gray-800">
                    <Menu className="h-6 w-6" />
                </Button>
                <div className="flex items-center gap-2 px-2 select-none cursor-pointer">
                    <div className="w-8 h-8 rounded shrink-0 bg-white flex items-center justify-center">
                        {/* Simple Gmail-like M logo placeholder */}
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 6H20C21.1 6 22 6.9 22 8V16C22 17.1 21.1 18 20 18H4C2.9 18 2 17.1 2 16V8C2 6.9 2.9 6 4 6Z" fill="#EA4335"/>
                            <path d="M4 8L12 13L20 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M4 8V16L12 11" fill="#C5221F"/>
                            <path d="M20 8V16L12 11" fill="#F4B400"/>
                        </svg>
                    </div>
                    <span className="text-[22px] font-normal text-[#444746] dark:text-[#e3e3e3] tracking-tight">Gmail</span>
                </div>
            </div>

            {/* Central Search Bar */}
            <div className="flex-1 max-w-[720px] mx-8 relative hidden md:block group z-20">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-full cursor-pointer transition-colors">
                    <Search className="h-5 w-5 text-[#444746] dark:text-gray-400 group-focus-within:text-[#1a73e8]" />
                </div>
                <Input
                    placeholder="Rechercher dans les messages"
                    className="w-full pl-14 pr-12 h-12 bg-[#eaf1fb] dark:bg-[#1f1f1f] border-transparent hover:bg-white hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3)] focus-visible:bg-white focus-visible:ring-0 focus-visible:shadow-[0_1px_2px_0_rgba(60,64,67,0.3)] transition-all rounded-full text-base dark:hover:bg-[#28292a] dark:focus-visible:bg-[#28292a] text-[#1f1f1f] dark:text-[#e3e3e3] placeholder:text-[#444746] dark:placeholder:text-gray-400"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-full cursor-pointer transition-colors">
                    <SlidersHorizontal className="h-5 w-5 text-[#444746] dark:text-gray-400" />
                </div>
            </div>

            {/* Right action area */}
            <div className="flex items-center gap-1 shrink-0 z-20">
                <Button variant="outline" size="sm" className="hidden lg:flex h-9 rounded-full border-gray-300 dark:border-gray-700 text-[#444746] dark:text-[#e3e3e3] font-medium px-4 hover:bg-gray-100 dark:hover:bg-gray-800 mr-2 gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-600"></div>
                    Actif
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1 opacity-60">
                        <path d="M5 6L0 1.05562L1.07143 0L5 3.88876L8.92857 0L10 1.05562L5 6Z" fill="currentColor"/>
                    </svg>
                </Button>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-[#444746] dark:text-[#e3e3e3] hover:bg-gray-100 dark:hover:bg-gray-800">
                    <HelpCircle className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-[#444746] dark:text-[#e3e3e3] hover:bg-gray-100 dark:hover:bg-gray-800">
                    <Settings className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-[#444746] dark:text-[#e3e3e3] hover:bg-gray-100 dark:hover:bg-gray-800 ml-1">
                    <Grid className="h-5 w-5" />
                </Button>
                <div className="mx-2 flex items-center justify-center">
                    <Avatar className="h-8 w-8 hover:ring-4 ring-gray-200 cursor-pointer transition-all">
                        <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" />
                        <AvatarFallback className="bg-[#1a73e8] text-white">AD</AvatarFallback>
                    </Avatar>
                </div>
            </div>
        </header>
    )
}
