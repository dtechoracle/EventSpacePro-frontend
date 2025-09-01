export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="w-full bg-gray-100 dark:bg-gray-900 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            My Website
          </h1>
          <nav className="space-x-6 text-gray-700 dark:text-gray-300">
            <a href="#">Home</a>
            <a href="#">About</a>
            <a href="#">Contact</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex items-center justify-center text-center px-4">
        <div>
          <h2 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
            Welcome to Event Space Pro
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
            This is just a starter page to be replaced by the design
          </p>
          <a
            href="#"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Get Started
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-gray-100 dark:bg-gray-900 py-4 mt-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-600 dark:text-gray-400">
          © {new Date().getFullYear()} My Website. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

