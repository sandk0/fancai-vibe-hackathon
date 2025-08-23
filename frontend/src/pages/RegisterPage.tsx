import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, BookOpen, User, Mail, Lock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { notify } from '@/stores/ui';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { cn } from '@/utils/cn';

const registerSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

const RegisterPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register: registerUser, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser(data.email, data.password, data.full_name);
      notify.success('Account Created!', 'Welcome to BookReader AI. Start uploading your first book!');
      navigate('/library', { replace: true });
    } catch (error: any) {
      notify.error(
        'Registration Failed',
        error.message || 'Please check your information and try again.'
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
            Create account
          </h2>
          <p className="text-gray-600">
            Join BookReader AI and start reading with AI-generated illustrations
          </p>
        </div>

        {/* Register Form */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Full Name Field */}
            <div>
              <label 
                htmlFor="full_name" 
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Full name (optional)
              </label>
              <div className="relative">
                <input
                  {...register('full_name')}
                  type="text"
                  autoComplete="name"
                  disabled={isLoading}
                  className={cn(
                    'w-full px-4 py-3 pl-12 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors',
                    errors.full_name ? 'border-error-500' : 'border-gray-300',
                    isLoading && 'opacity-50 cursor-not-allowed'
                  )}
                  placeholder="Enter your full name"
                />
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
              {errors.full_name && (
                <p className="mt-1 text-sm text-error-600">
                  {errors.full_name.message}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email address
              </label>
              <div className="relative">
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  disabled={isLoading}
                  className={cn(
                    'w-full px-4 py-3 pl-12 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors',
                    errors.email ? 'border-error-500' : 'border-gray-300',
                    isLoading && 'opacity-50 cursor-not-allowed'
                  )}
                  placeholder="Enter your email"
                />
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
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
                  autoComplete="new-password"
                  disabled={isLoading}
                  className={cn(
                    'w-full px-4 py-3 pl-12 pr-12 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors',
                    errors.password ? 'border-error-500' : 'border-gray-300',
                    isLoading && 'opacity-50 cursor-not-allowed'
                  )}
                  placeholder="Create a password"
                />
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
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

            {/* Confirm Password Field */}
            <div>
              <label 
                htmlFor="confirmPassword" 
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Confirm password
              </label>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={isLoading}
                  className={cn(
                    'w-full px-4 py-3 pl-12 pr-12 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors',
                    errors.confirmPassword ? 'border-error-500' : 'border-gray-300',
                    isLoading && 'opacity-50 cursor-not-allowed'
                  )}
                  placeholder="Confirm your password"
                />
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-error-600">
                  {errors.confirmPassword.message}
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
                  Creating account...
                </div>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-primary-600 hover:text-primary-500 transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        {/* Terms */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            By creating an account, you agree to our{' '}
            <a href="#" className="text-primary-600 hover:text-primary-500">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-primary-600 hover:text-primary-500">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;