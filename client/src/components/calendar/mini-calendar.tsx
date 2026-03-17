"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface MiniCalendarProps {
  selectedDate?: Date
  onSelectDate?: (date: Date) => void
  className?: string
}

const DAYS = ["L", "M", "M", "J", "V", "S", "D"]
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"
]

export function MiniCalendar({ selectedDate, onSelectDate, className }: MiniCalendarProps) {
  const [viewDate, setViewDate] = useState(() => selectedDate || new Date())

  const { year, month, days } = useMemo(() => {
    const y = viewDate.getFullYear()
    const m = viewDate.getMonth()

    // First day of month (0 = Sunday, we want Monday = 0)
    const firstDay = new Date(y, m, 1)
    let startDay = firstDay.getDay() - 1
    if (startDay < 0) startDay = 6 // Sunday becomes 6

    // Days in month
    const daysInMonth = new Date(y, m + 1, 0).getDate()

    // Days from previous month
    const prevMonthDays = new Date(y, m, 0).getDate()

    const calendarDays: { day: number; isCurrentMonth: boolean; date: Date }[] = []

    // Previous month days
    for (let i = startDay - 1; i >= 0; i--) {
      const day = prevMonthDays - i
      calendarDays.push({
        day,
        isCurrentMonth: false,
        date: new Date(y, m - 1, day),
      })
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      calendarDays.push({
        day: d,
        isCurrentMonth: true,
        date: new Date(y, m, d),
      })
    }

    // Next month days to fill the grid (6 rows x 7 days = 42)
    const remaining = 42 - calendarDays.length
    for (let d = 1; d <= remaining; d++) {
      calendarDays.push({
        day: d,
        isCurrentMonth: false,
        date: new Date(y, m + 1, d),
      })
    }

    return { year: y, month: m, days: calendarDays }
  }, [viewDate])

  const today = new Date()
  const isToday = (date: Date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()

  const isSelected = (date: Date) =>
    selectedDate &&
    date.getDate() === selectedDate.getDate() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getFullYear() === selectedDate.getFullYear()

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  const handleDateClick = (date: Date) => {
    onSelectDate?.(date)
    // If clicking on a day from another month, also navigate to that month
    if (date.getMonth() !== month) {
      setViewDate(date)
    }
  }

  return (
    <div className={cn("select-none", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={prevMonth}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-[#5f6368]" />
        </button>
        <span className="text-sm font-medium text-[#3c4043] capitalize">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-[#5f6368]" />
        </button>
      </div>

      {/* Days header */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {DAYS.map((day, i) => (
          <div
            key={i}
            className="h-6 flex items-center justify-center text-[10px] font-medium text-[#70757a]"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0">
        {days.map((d, i) => (
          <button
            key={i}
            onClick={() => handleDateClick(d.date)}
            className={cn(
              "h-6 w-6 mx-auto flex items-center justify-center text-xs rounded-full transition-colors",
              d.isCurrentMonth
                ? "text-[#3c4043] hover:bg-gray-100"
                : "text-[#b0b5b9] hover:bg-gray-50",
              isToday(d.date) && "bg-[#1a73e8] text-white hover:bg-[#1557b0]",
              isSelected(d.date) && !isToday(d.date) && "bg-[#e8f0fe] text-[#1a73e8]"
            )}
          >
            {d.day}
          </button>
        ))}
      </div>
    </div>
  )
}
