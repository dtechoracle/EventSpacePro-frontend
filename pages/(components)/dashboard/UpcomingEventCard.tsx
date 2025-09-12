const UpcomingEventCard = () => {
  return (
    <div
      className="bg-gray-50 p-4 rounded-xl"
    >
      <div className="flex justify-between items-center text-sm text-gray-500 mb-6">
        <span className="text-black font-medium">Upcoming Event</span>
        <span>Sept 15, 2025</span>
      </div>
      <h2 className="font-bold text-2xl mb-3">
        Annual Dinner Gala
      </h2>
      <div className="mb-4">
        <p className="text-gray-600 text-sm">
          <b>Total Guests: </b>250/300 Guests
        </p>
        <p className="text-gray-600 text-sm mb-4">
          <b>Budget Utilized:</b> $8,000 of $10,000
        </p>
      </div>
      <div className="flex gap-2">
        <button className="bg-[var(--accent)] text-white text-sm px-4 py-1 rounded-full hover:bg-blue-700">
          View Details
        </button>
        <button className="bg-black text-white text-sm px-4 py-1 rounded-full hover:bg-black/70">
          Edit
        </button>
      </div>
    </div>
  )
}

export default UpcomingEventCard
