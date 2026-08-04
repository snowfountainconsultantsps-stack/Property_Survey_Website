import { Link } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import ThemeToggle from '../components/ThemeToggle';

export default function Home() {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-950">
      {/* Navbar */}
      <nav className="bg-white dark:bg-gray-800 shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Property Survey</h1>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <span className="text-gray-700 dark:text-gray-300 font-medium">Welcome, {user?.name || 'User'}</span>
                <Link
                  to="/login"
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-lg transition"
                >
                  Logout
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold py-2 px-6 transition"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
                >
                  Sign Up
                </Link>
              </>
            )}
            <ThemeToggle className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Welcome to Property Survey
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            Manage your property surveys with ease and efficiency
          </p>

          {!isAuthenticated && (
            <div className="flex gap-4 justify-center">
              <Link
                to="/login"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition"
              >
                Get Started
              </Link>
              <Link
                to="/register"
                className="border-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 font-semibold py-3 px-8 rounded-lg transition"
              >
                Learn More
              </Link>
            </div>
          )}

          {isAuthenticated && (
            <div className="mt-8">
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition">
                View Properties
              </button>
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 hover:shadow-lg dark:hover:shadow-none transition">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Analytics</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Get detailed insights and analytics about your properties.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 hover:shadow-lg dark:hover:shadow-none transition">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Secure</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Your data is secure and protected with industry-standard encryption.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 hover:shadow-lg dark:hover:shadow-none transition">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Fast</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Quick and efficient property management at your fingertips.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
