"use client";

import { useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function generateCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days: (number | null)[] = [];

  // Empty slots before first day
  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(null);
  }

  // Fill in days of month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(d);
  }

  return days;
}

export default function CustomCalendar() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const days = generateCalendar(currentYear, currentMonth);
  const monthName = new Date(currentYear, currentMonth).toLocaleString("default", {
    month: "long",
  });

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  return (
    <div className="w-full max-w-md p-4 rounded-xl bg-white shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 rounded-full hover:bg-gray-100"
        >
          <FiChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold">
          {monthName} {currentYear}
        </h2>
        <button
          onClick={nextMonth}
          className="p-2 rounded-full hover:bg-gray-100"
        >
          <FiChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 text-center text-sm font-medium text-gray-500">
        {daysOfWeek.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-7 mt-2 text-center">
        {days.map((day, idx) => {
          const isToday =
            day === today.getDate() &&
            currentMonth === today.getMonth() &&
            currentYear === today.getFullYear();

          return (
            <div
              key={idx}
              className={`h-10 flex items-center justify-center rounded-lg text-sm
                ${day ? "cursor-pointer" : "bg-transparent"}
                ${
                  isToday
                    ? "bg-[var(--accent)] text-white font-bold"
                    : "hover:bg-gray-100"
                }`}
            >
              {day || ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

