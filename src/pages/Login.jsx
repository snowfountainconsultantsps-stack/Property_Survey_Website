import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLoginMutation } from '../store/api/authApi';
import { BarChart3, Lock, Zap, Smartphone, KeyRound, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import ThemeToggle from '../components/ThemeToggle';

export default function Login() {
  const navigate = useNavigate();
  const [login] = useLoginMutation();

  const [formData, setFormData] = useState({
    mobile: '',
    password: '',
  });
  const [errors, setErrors] = useState({
    mobile: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    // Validate mobile number
    if (!formData.mobile.trim()) {
      newErrors.mobile = 'Mobile number is required';
    } else if (!/^[6-9]\d{9}$/.test(formData.mobile.replace(/\D/g, ''))) {
      newErrors.mobile = 'Mobile number must start with 6, 7, 8, or 9 and be 10 digits';
    }

    // Validate password
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
       const response = await login({
        phone: formData.mobile.replace(/\D/g, ''),
        password: formData.password,
      }).unwrap();

      const successMessage = response?.message || 'Login successful!';
      toast.success(successMessage);

      const userRole = response?.data?.user?.role;
      console.log('Login response:', response?.data?.user?.role);
      if (userRole === 'ADMIN') {
        navigate('/admin');
      } else if (userRole === 'GIS_EDITOR' || userRole === 'GIS_ADMIN') {
        navigate('/gis');
      } else {
        navigate('/login');
      }
    } catch (err) {
      const errorMessage = err?.data?.message || 'Login failed. Please check your credentials.';
      toast.error(errorMessage);
      setErrors({
        mobile: '',
        password: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
      <ThemeToggle className="fixed top-4 right-4 z-20 bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-700 backdrop-blur" />

      {/* Left Side - About Section (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white flex-col justify-center items-center p-12 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        
        <div className="max-w-md relative z-10">
          <div className="mb-8">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-white/20">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-5xl font-bold mb-4">Property Survey</h1>
            <p className="text-lg text-blue-100 leading-relaxed">
              Manage your property surveys with precision and ease. Get comprehensive insights and analytics about your properties all in one intuitive platform.
            </p>
          </div>
          
          <div className="space-y-4 my-12">
            <div className="flex items-start gap-4 group">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-white/10 backdrop-blur-md group-hover:bg-white/20 transition-all border border-white/20 group-hover:border-white/40">
                  <BarChart3 className="h-6 w-6 text-blue-200" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Advanced Analytics</h3>
                <p className="text-blue-100 text-sm">Detailed insights and visual reports about your properties</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 group">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-white/10 backdrop-blur-md group-hover:bg-white/20 transition-all border border-white/20 group-hover:border-white/40">
                  <Lock className="h-6 w-6 text-blue-200" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Enterprise Security</h3>
                <p className="text-blue-100 text-sm">Your data is protected with bank-level encryption</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 group">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-white/10 backdrop-blur-md group-hover:bg-white/20 transition-all border border-white/20 group-hover:border-white/40">
                  <Zap className="h-6 w-6 text-blue-200" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Lightning Fast</h3>
                <p className="text-blue-100 text-sm">Quick and efficient property management at your fingertips</p>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/20">
            <p className="text-sm text-blue-100">✓ Join 10,000+ property managers worldwide</p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 bg-white dark:bg-gray-900 lg:bg-gray-50 lg:dark:bg-gray-900 flex items-center justify-center px-4 py-8 lg:py-12">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 lg:p-8 border border-gray-100 dark:border-gray-700">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl mb-4 shadow-lg">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome Back</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Sign in to your account</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="mobile" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Mobile Number
                </label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
                  <input
                    id="mobile"
                    name="mobile"
                    type="tel"
                    value={formData.mobile}
                    onChange={handleChange}
                    placeholder="10-digit mobile number"
                    maxLength="10"
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition bg-gray-50 dark:bg-gray-700 hover:bg-white dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 ${
                      errors.mobile ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                    }`}
                  />
                </div>
                {errors.mobile && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.mobile}</p>}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition bg-gray-50 dark:bg-gray-700 hover:bg-white dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 ${
                      errors.password ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.password}</p>}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Signing In...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Sign In
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer text */}
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
