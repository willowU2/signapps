import { useState, useEffect } from "react";
import { Clock, Plus, Video, Calendar } from "lucide-react";
import { calendarApi } from "@/lib/api";

export function CalendarWidget() {
    const today = new Date();
    const formattedDate = new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    }).format(today);

    const [events, setEvents] = useState<Array<{ id: string; title: string; time: string; duration: string; type: string }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchEvents() {
            try {
                const start = new Date();
                start.setHours(0, 0, 0, 0);
                const end = new Date();
                end.setHours(23, 59, 59, 999);

                const res = await calendarApi.listEvents("primary", start, end);
                const data = res.data || [];
                setEvents(data.map((e: any) => ({
                    id: e.id,
                    title: e.title || e.summary || "Sans titre",
                    time: new Date(e.start_time || e.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                    duration: e.duration || '',
                    type: e.location?.includes('meet') || e.location?.includes('zoom') ? 'video' : 'meeting',
                })));
            } catch {
                setEvents([]);
            } finally {
                setLoading(false);
            }
        }
        fetchEvents();
    }, []);

    return (
        <div className="p-4 flex flex-col gap-6 h-full animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Aujourd'hui</h3>
                    <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{formattedDate}</p>
                </div>
                <button className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-full transition-colors" title="Nouvel événement">
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                        Chargement...
                    </div>
                ) : events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Calendar className="w-10 h-10 text-gray-300 dark:text-muted-foreground mb-3" />
                        <p className="text-sm text-gray-400">Aucun événement aujourd'hui</p>
                    </div>
                ) : (
                    <div className="relative border-l border-border dark:border-gray-700/50 pl-4 py-2 space-y-6">
                        <div className="absolute top-10 left-[-4px] w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                        <div className="absolute top-11 left-0 w-8 h-px bg-red-400"></div>

                        {events.map((event) => (
                            <div key={event.id} className="relative group p-3 bg-background dark:bg-gray-800/80 rounded-xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-700/50 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all hover:shadow-md cursor-pointer">
                                <div className="absolute top-1/2 -left-[21px] -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-[#1a1a1a] group-hover:bg-indigo-500 transition-colors"></div>

                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{event.title}</span>
                                    {event.type === 'video' && <Video className="w-4 h-4 text-blue-500 shrink-0" />}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    <span>{event.time}</span>
                                    {event.duration && <span>· {event.duration}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
