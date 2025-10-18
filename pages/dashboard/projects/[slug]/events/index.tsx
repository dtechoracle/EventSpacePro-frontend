import EventCard from "@/pages/(components)/projects/EventCard";
import TopBar from "@/pages/(components)/projects/TopBar";
import MainLayout from "@/pages/layouts/MainLayout";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import { AssetInstance } from "@/store/sceneStore";

interface EventData {
  _id: string;
  name: string;
  canvasAssets: AssetInstance[];
  createdAt: string;
  updatedAt: string;
  __v: number;
}

interface ApiResponse {
  data: EventData[];
}

// Shimmer loading component
const EventCardShimmer = () => (
  <div className="relative w-full h-60 rounded-3xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
    {/* Background shimmer - matching the actual card's gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-cyan-100/30 to-yellow-100/30">
      <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-200/40 rounded-full blur-3xl opacity-70" />
      <div className="absolute top-10 right-10 w-32 h-32 bg-yellow-200/40 rounded-full blur-3xl opacity-70" />
      <div className="absolute bottom-10 left-1/3 w-32 h-32 bg-blue-200/40 rounded-full blur-3xl opacity-70" />
    </div>

    {/* Shimmer animation overlay */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>

    {/* Frosted overlay shimmer */}
    <div className="absolute inset-0 bg-white/40 backdrop-blur-lg"></div>

    {/* Stylized grooves */}
    <div className="absolute top-0 left-0 w-full h-6 flex items-center justify-between px-4">
      <div className="w-10 h-1 bg-black/20 rounded-full animate-pulse" />
      <div className="w-10 h-1 bg-black/20 rounded-full animate-pulse" />
    </div>

    {/* Content shimmer */}
    <div className="absolute bottom-0 left-0 w-full p-4 flex justify-between items-end">
      <div className="flex-1">
        <div className="h-5 bg-black/20 rounded w-3/4 mb-2 animate-pulse"></div>
        <div className="h-4 bg-gray-500/30 rounded w-1/2 animate-pulse"></div>
      </div>
      <div className="w-8 h-8 bg-black/20 rounded-full animate-pulse"></div>
    </div>
  </div>
);

const Events = () => {
  const router = useRouter();
  const { slug } = router.query;

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ["events", slug],
    queryFn: () => apiRequest(`/projects/${slug}/events`, "GET", null, true),
    enabled: !!slug, // Only run query when slug is available
  });

  return (
    <MainLayout>
      <div className="w-full min-h-screen">
        <TopBar mainText={`Project ${slug}`} subText="Events" type="event" />

        {isLoading && (
          <div className="grid grid-cols-4 gap-3 pl-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <EventCardShimmer key={index} />
            ))}
          </div>
        )}

        {error && (
          <div className="flex justify-center items-center h-64">
            <p className="text-red-500">Error loading events</p>
          </div>
        )}

        {data && data.data && (
          <div className="grid grid-cols-4 gap-3 pl-6">
            {data.data.map((event) => (
              <EventCard key={event?._id || Math.random()} event={event} />
            ))}
          </div>
        )}

        {data && data.data && data.data.length === 0 && (
          <div className="flex justify-center items-center h-64">
            <p className="text-gray-500">
              No events found. Create your first event!
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Events;
