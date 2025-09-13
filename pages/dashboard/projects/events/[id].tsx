import EventCard from "@/pages/(components)/projects/EventCard"
import TopBar from "@/pages/(components)/projects/TopBar"
import MainLayout from "@/pages/layouts/MainLayout"
import { useRouter } from "next/router";

const Events = () => {

const router = useRouter();
  const { id } = router.query;

  return (
    <MainLayout>
    <div className="w-full min-h-screen">
        <TopBar mainText={`Project ${id}`} subText="Events"/>
        <div className="grid grid-cols-4 gap-3 pl-6">
          {
            Array.from({ length: 8 }).map((_, i) => (
              <EventCard key={i} id={i} />
            ))
          }
        </div>
      </div>
    </MainLayout>
  )
}

export default Events
