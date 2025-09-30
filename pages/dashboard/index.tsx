import BudgetAndAI from "../(components)/dashboard/BudgetAndAI";
import CustomCalendar from "../(components)/dashboard/Calander";
import PendingTasks from "../(components)/dashboard/PendingTasks";
import UpcomingEventCard from "../(components)/dashboard/UpcomingEventCard";
import MainLayout from "../layouts/MainLayout";
import { BsStars } from "react-icons/bs";
import { useUserStore } from "@/store/userStore";
import { useEffect } from "react";

const Dashboard = () => {
  const { user, fetchUser, isLoading } = useUserStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <MainLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold">Hi, {user?.firstName}!</h1>
            <p className="text-gray-500">Ready create another masterpiece?</p>
          </div>
          <button className="bg-[var(--accent)] flex items-center gap-3 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700">
            <BsStars />
            Create Event with AI
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <UpcomingEventCard key={i} />
              ))}
            </div>

            {/* Budget & AI Suggestions */}
            <BudgetAndAI />
          </div>

          <div className="space-y-6">
            {/* Calendar */}
            <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-center">
              <CustomCalendar />
            </div>

            <div className="p-4 rounded-xl bg-gray-50">
              <h3 className="font-semibold mb-4">Pending Tasks</h3>
              {[1, 2].map((i) => (
                <PendingTasks key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
