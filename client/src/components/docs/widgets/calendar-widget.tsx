import { Clock, Plus, Video } from "lucide-react";

export function CalendarWidget() {
    const today = new Date();
    const formattedDate = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    }).format(today);

    // Mock upcoming events
    const events = [
        { id: 1, title: 'Weekly Sync', time: '10:00 AM', duration: '45m', type: 'video' },
        { id: 2, title: 'Project Review', time: '1:30 PM', duration: '1h', type: 'meeting' },
        { id: 3, title: 'Client Call', time: '4:00 PM', duration: '30m', type: 'video' }
    ];

    return (
        <div className="p-4 flex flex-col gap-6 h-full animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Today</h3>
                    <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{formattedDate}</p>
                </div>
                <button className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-full transition-colors" title="New Event">
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
                <div className="relative border-l border-gray-200 dark:border-gray-700/50 pl-4 py-2 space-y-6">
                    {/* Current Time Indicator line */}
                    <div className="absolute top-10 left-[-4px] w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                    <div className="absolute top-11 left-0 w-8 h-px bg-red-400"></div>

                    {events.map((event) => (
                        <div key={event.id} className="relative group p-3 bg-background dark:bg-gray-800/80 rounded-xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-700/50 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all hover:shadow-md cursor-pointer">
                            <div className="absolute top-1/2 -left-[21px] -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-[#1a1a1a] group-hover:bg-indigo-500 transition-colors"></div>

                            <div className="flex justify-between items-start mb-1">
                                <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm leading-tight">{event.title}</h4>
                                {event.type === 'video' && <Video className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-2">
                                <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900/50 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
                                    <Clock className="w-3 h-3" />
                                    <span>{event.time}</span>
                                </div>
                                <span>·</span>
                                <span>{event.duration}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
