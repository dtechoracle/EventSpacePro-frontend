import EventCard from "@/pages/(components)/projects/EventCard"
import TopBar from "@/pages/(components)/projects/TopBar"
import MainLayout from "@/pages/layouts/MainLayout"
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import { ImSpinner8 } from "react-icons/im";
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
        <TopBar mainText={`Project ${slug}`} subText="Events" type="event"/>
        
        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <ImSpinner8 size={40} className="animate-spin text-gray-400" />
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
            <p className="text-gray-500">No events found. Create your first event!</p>
          </div>
        )}
      </div>
    </MainLayout>
  )
}

export default Events
