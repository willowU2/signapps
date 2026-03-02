import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Menu, ChevronLeft, ChevronRight, Search, HelpCircle, Settings, Grid, ChevronDown } from "lucide-react";
import { ViewMode } from "@/stores/calendar-store";

interface CalendarHeaderProps {
  viewMode: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export function CalendarHeader({ viewMode, onViewModeChange }: CalendarHeaderProps) {
  return (
      <header className="h-16 shrink-0 flex items-center justify-between px-2 pr-6 border-b border-gray-100 dark:border-[#2b2d31]">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full text-[#5f6368] hover:bg-gray-100">
            <Menu className="h-6 w-6" />
          </Button>
          
          <div className="flex items-center gap-2 px-1 select-none pr-6 cursor-pointer">
            <div className="w-10 h-10 flex flex-col items-center justify-center -mt-1">
               {/* Google Calendar Logo Mock */}
               <div className="bg-[#1a73e8] text-white w-9 h-9 rounded-[10px] flex flex-col items-center shadow-sm overflow-hidden">
                 <div className="bg-blue-600/20 w-full h-[6px]"></div>
                 <span className="text-[19px] font-bold leading-none mt-1">2</span>
               </div>
            </div>
            <span className="text-[22px] text-[#5f6368] ml-1">Agenda</span>
          </div>

          <Button variant="outline" className="h-9 px-4 rounded-md border-gray-300 font-medium text-sm text-[#3c4043] ml-2 hover:bg-gray-50 shadow-sm transition-colors">
            Aujourd&apos;hui
          </Button>

          <div className="flex items-center gap-1 mx-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-[#5f6368] hover:bg-gray-100">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-[#5f6368] hover:bg-gray-100">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <span className="text-[22px] text-[#3c4043] font-normal ml-2 tracking-tight">Mars 2026</span>
        </div>

        {/* Right header actions */}
        <div className="flex items-center gap-1 shrink-0 z-20">
            <div className="flex items-center gap-2 mr-2">
               <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-[#5f6368] hover:bg-gray-100">
                  <Search className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-[#5f6368] hover:bg-gray-100">
                  <HelpCircle className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-[#5f6368] hover:bg-gray-100">
                  <Settings className="h-5 w-5" />
              </Button>
            </div>

            <Button variant="outline" className="h-9 px-3 rounded-md border-gray-300 font-medium text-sm text-[#3c4043] gap-2 hover:bg-gray-50 shadow-sm flex items-center group">
              {viewMode === "day" ? "Jour" : viewMode === "week" ? "Semaine" : "Mois"}
              <ChevronDown className="h-4 w-4 text-[#5f6368] group-hover:text-[#3c4043]" />
            </Button>

            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-[#5f6368] hover:bg-gray-100 ml-4 mr-2">
                <Grid className="h-5 w-5" />
            </Button>
            
            <Avatar className="h-8 w-8 hover:ring-4 ring-gray-100 cursor-pointer transition-all">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" />
                <AvatarFallback className="bg-[#1a73e8] text-white">AD</AvatarFallback>
            </Avatar>
        </div>
      </header>
  );
}
