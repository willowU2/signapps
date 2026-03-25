"use client";

import { type ComponentProps, useState } from "react";

import { Calendar } from "@/components/ui/calendar";

export const title = "Calendar with Custom Select Day Style";

const now = new Date();

// Fixed demo dates spread across the current month (no faker dependency)
const bookedDays = [
  new Date(now.getFullYear(), now.getMonth(), 5),
  new Date(now.getFullYear(), now.getMonth(), 14),
  new Date(now.getFullYear(), now.getMonth(), 22),
];

const Example = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const modifiers = {
    booked: bookedDays,
  };

  const modifiersStyles: ComponentProps<typeof Calendar>["modifiersStyles"] = {
    booked: {
      backgroundColor: "#fbbf24",
      color: "#78350f",
      fontWeight: "bold",
    },
  };

  return (
    <Calendar
      className="rounded-md border"
      classNames={{
        day_button: "rounded-full",
        day: "rounded-full",
        today: "rounded-full",
      }}
      mode="single"
      modifiers={modifiers}
      modifiersStyles={modifiersStyles}
      onSelect={setDate}
      selected={date}
    />
  );
};

export default Example;
