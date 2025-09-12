const PendingTasks = () => {
  return (
        <div className="mb-4 last:mb-0 border-2 border-gray-100 space-y-5 p-3">
          <p className="font-semibold text-xl">
            Final Check for Catering
          </p>
          <p className="text-xs text-gray-500">
            <b>Due Date:</b> Sept 7, 2025
          </p>
          <p className="text-xs text-gray-500 mb-2">
            <b>Status:</b> Pending
          </p>
          <div className="flex gap-2">
            <button className="bg-[var(--accent)] text-white text-xs px-3 py-1 rounded-full">
              Mark as done
            </button>
            <button className="bg-black text-white text-xs px-3 py-1 rounded-full hover:bg-black/80">
              Send follow up
            </button>
          </div>
        </div>

  )
}

export default PendingTasks
