import React from "react"
import { Calendar as CalendarIcon, Lightbulb, CheckCircle2, Users, Plus } from "lucide-react"

export function MailAddons() {
    return (
        <div className="w-14 shrink-0 bg-transparent flex flex-col items-center py-4 px-2 gap-6 z-10 mb-4">
            <div className="w-10 h-10 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-center transition-colors">
                <CalendarIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div className="w-10 h-10 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-center transition-colors">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="w-10 h-10 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-center transition-colors">
                <CheckCircle2 className="w-5 h-5 text-blue-500" />
            </div>
            <div className="w-10 h-10 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-center transition-colors">
                <Users className="w-5 h-5 text-blue-400" />
            </div>
            
            <div className="w-6 h-px bg-gray-300 dark:bg-gray-700 my-2"></div>
            
            <div className="w-10 h-10 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-center transition-colors">
                <Plus className="w-5 h-5 text-gray-500" />
            </div>
        </div>
    )
}
