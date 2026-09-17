import BudgetUtilization from "./BudgetUtilization"

const BudgetAndAI = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-gray-50 rounded-xl">
      {/* Budget Utilization */}
      <div className="p-4">
        <h3 className="font-semibold mb-2 text-lg">Budget Utilization</h3>
        <div className="flex justify-center items-center h-40">
          {/* Replace with chart later */}
          <BudgetUtilization />
        </div>
      </div>

      {/* AI Suggestions */}
      <div className=" p-4">
        <h3 className="font-semibold mb-2 text-lg">AI Suggestions</h3>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="p-3 rounded-lg border border-gray-200 bg-gray-50 flex justify-between items-start"
            >
              <div>
                <p className="font-medium text-2xl">Optimize Decor budget</p>
                <p className="text-sm">
                  Lorem ipsum dolor amet ispin dolor...
                </p>
                <button className="bg-[var(--accent)] text-white text-xs mt-2 p-2 rounded-full">
                  View Details
                </button>
              </div>
              <button className="text-gray-400 hover:text-red-500">✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default BudgetAndAI
