"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const data = [
  { name: "Total Spent", value: 35 },
  { name: "Budget Left", value: 15 },
];

const COLORS = ["#0056A9", "#2C2B35"];

export default function BudgetUtilization() {
  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            startAngle={180}
            endAngle={0}
            innerRadius={50}
            outerRadius={80}
            cx="50%"
            cy="100%"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Legend (unchanged) */}
      <div className="flex justify-center gap-12 mt-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#0933BB]" />
          <div>
            <p className="text-lg font-bold">$35K</p>
            <p className="text-sm text-gray-500">Total Spent</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-gray-400" />
          <div>
            <p className="text-lg font-bold">$15K</p>
            <p className="text-sm text-gray-500">Budget Left</p>
          </div>
        </div>
      </div>
    </div>

  );
}

