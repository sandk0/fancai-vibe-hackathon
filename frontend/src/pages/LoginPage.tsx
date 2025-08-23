import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, BookOpen } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { notify } from '@/stores/ui';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { cn } from '@/utils/cn';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from || '/library';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      notify.success('Welcome back!', 'You have been successfully logged in.');
      navigate(from, { replace: true });
    } catch (error: any) {
      notify.error(
        'Login Failed', 
        error.message || 'Please check your credentials and try again.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-primary-600 rounded-full">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back
          </h2>
          <p className="text-gray-600">
            Sign in to continue reading with AI-generated illustrations
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Field */}
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email address
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                disabled={isLoading}
                className={cn(
                  'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors',
                  errors.email ? 'border-error-500' : 'border-gray-300',
                  isLoading && 'opacity-50 cursor-not-allowed'
                )}
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-error-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isLoading}
                  className={cn(
                    'w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors',
                    errors.password ? 'border-error-500' : 'border-gray-300',
                    isLoading && 'opacity-50 cursor-not-allowed'
                  )}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-error-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-medium transition-colors',
                'hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <LoadingSpinner size="small" color="white" className="mr-2" />
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-medium text-primary-600 hover:text-primary-500 transition-colors"
              >
                Sign up here
              </Link>
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-500">
            ✨ AI-powered image generation
          </p>
          <p className="text-sm text-gray-500">
            📚 EPUB and FB2 support
          </p>
          <p className="text-sm text-gray-500">
            🎨 Customizable reading experience
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;