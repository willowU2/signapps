import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Users } from "lucide-react";
import { Calendar } from "@/types/calendar";

interface CalendarSidebarProps {
  calendars: Calendar[];
  selectedCalendarId: string | null;
  onSelectCalendar: (calendarId: string) => void;
  onCreateEvent: () => void;
}

export function CalendarSidebar({
  calendars,
  selectedCalendarId,
  onSelectCalendar,
  onCreateEvent
}: CalendarSidebarProps) {
  return (
        <div className="w-64 h-full shrink-0 border-r border-transparent flex flex-col py-3 pb-8 px-2 pl-3 z-10 overflow-y-auto no-scrollbar">
          
          <Button 
            className="w-auto ml-2 h-[48px] px-4 pr-5 rounded-full shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] bg-background hover:bg-[#f6f9fe] hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),0_4px_8px_3px_rgba(60,64,67,0.15)] transition-all font-medium text-[#3c4043] self-start border-none justify-start flex gap-3 z-20 group"
            onClick={onCreateEvent}
          >
            <div className="relative w-6 h-6 flex items-center justify-center -ml-1">
              {/* Fake multicolor Google + icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" className="absolute">
                <path d="M12 20V12H4V8H12V0H16V8H24V12H16V20H12Z" fill="url(#multi-gradient)"/>
                <defs>
                   <linearGradient id="multi-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                     <stop offset="0%" stopColor="#EA4335" />
                     <stop offset="33%" stopColor="#FBBC04" />
                     <stop offset="66%" stopColor="#34A853" />
                     <stop offset="100%" stopColor="#4285F4" />
                   </linearGradient>
                </defs>
              </svg>
            </div>
            Créer
            <ChevronDown className="h-4 w-4 text-[#5f6368] opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
          </Button>

          {/* Mini Calendar Section */}
          <div className="mt-4 px-3 relative z-10">
              {/* TODO: Add a proper MiniCalendar component here instead of the full MonthCalendar */}
          </div>

          {/* Search Contacts input */}
          <div className="px-3 mt-4 mb-2 relative">
             <div className="relative group">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5f6368] pointer-events-none" />
                <Input 
                   placeholder="Rechercher des co..." 
                   className="pl-9 h-9 border-none bg-gray-100/50 hover:bg-gray-100 focus:bg-background focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded text-sm placeholder:text-[#5f6368] shadow-none"
                />
             </div>
          </div>

          {/* Side Panels area (Mocking the Checkbox lists) */}
          <div className="flex-1 overflow-y-auto w-[240px] px-1 mt-4">
             {/* Accordion 1 */}
             <div className="flex items-center justify-between py-2 px-2 hover:bg-gray-50 rounded cursor-pointer group">
                <span className="text-sm font-medium text-[#3c4043]">Plages de réservation</span>
                <ChevronDown className="h-4 w-4 text-[#5f6368] opacity-0 group-hover:opacity-100" />
             </div>
             
             {/* Accordion 2 */}
             <div className="flex items-center justify-between py-2 px-2 hover:bg-gray-50 rounded cursor-pointer group mt-2">
                <span className="text-sm font-medium text-[#3c4043]">Mes agendas</span>
                <ChevronDown className="h-4 w-4 text-[#5f6368] opacity-0 group-hover:opacity-100" />
             </div>
             <div className="flex flex-col gap-1 px-2 mt-1">
                {calendars.map((calendar) => (
                  <label key={calendar.id} className="flex items-center gap-3 py-1 cursor-pointer group rounded hover:bg-gray-50 -mx-1 px-1">
                    <div className="relative flex items-center justify-center">
                        <input type="checkbox" className="peer appearance-none w-4 h-4 border-2 rounded-[3px] border-[#5f6368] checked:border-transparent checked:bg-current transition-colors" style={{color: calendar.color || '#3b82f6'}} checked={selectedCalendarId === calendar.id} onChange={() => onSelectCalendar(calendar.id)} />
                        <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <span className="text-sm text-[#3c4043] truncate leading-tight mt-0.5">{calendar.name}</span>
                  </label>
                ))}
                {/* Extra fake calendars */}
                <label className="flex items-center gap-3 py-1 cursor-pointer group rounded hover:bg-gray-50 -mx-1 px-1 mt-1">
                    <div className="relative flex items-center justify-center">
                        <input type="checkbox" className="peer appearance-none w-4 h-4 border-2 rounded-[3px] border-[#5f6368] checked:border-transparent checked:bg-current transition-colors text-[#34A853]" defaultChecked />
                        <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <span className="text-sm text-[#3c4043] truncate leading-tight mt-0.5">Anniversaires</span>
                </label>
                <label className="flex items-center gap-3 py-1 cursor-pointer group rounded hover:bg-gray-50 -mx-1 px-1 mt-1">
                    <div className="relative flex items-center justify-center">
                        <input type="checkbox" className="peer appearance-none w-4 h-4 border-2 rounded-[3px] border-[#5f6368] checked:border-transparent checked:bg-current transition-colors text-[#F4B400]" defaultChecked />
                        <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <span className="text-sm text-[#3c4043] truncate leading-tight mt-0.5">Samuel EXEL</span>
                </label>
             </div>

             {/* Accordion 3 */}
             <div className="flex items-center justify-between py-2 px-2 hover:bg-gray-50 rounded cursor-pointer group mt-4">
                <span className="text-sm font-medium text-[#3c4043]">Autres agendas</span>
                <ChevronDown className="h-4 w-4 text-[#5f6368] opacity-0 group-hover:opacity-100" />
             </div>
             <div className="flex flex-col gap-1 px-2 mt-1">
                <label className="flex items-center gap-3 py-1 cursor-pointer group rounded hover:bg-gray-50 -mx-1 px-1">
                    <div className="relative flex items-center justify-center">
                        <input type="checkbox" className="peer appearance-none w-4 h-4 border-2 rounded-[3px] border-[#5f6368] checked:border-transparent checked:bg-current transition-colors text-[#0b8043]" defaultChecked />
                        <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <span className="text-sm text-[#3c4043] truncate leading-tight mt-0.5">Jours fériés</span>
                </label>
             </div>

          </div>
        </div>
  );
}
