/**
 * LoginPage - Modern redesign with split-screen layout
 *
 * Features:
 * - Split layout: form left, gradient right
 * - Modern input fields with icons
 * - Form validation with react-hook-form + zod
 * - Password visibility toggle
 * - Theme-aware design
 * - Responsive mobile layout
 */

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, BookOpen, Mail, Lock, CheckCircle2, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { notify } from '@/stores/ui';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().email('Неправильный email адрес'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
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
      notify.success('Добро пожаловать!', 'Вы успешно вошли в систему');
      navigate(from, { replace: true });
    } catch (error) {
      notify.error('Ошибка входа', getErrorMessage(error, 'Проверьте email и пароль'));
    }
  };

  const benefits = [
    'Умное распознавание описаний с Multi-NLP',
    'Автоматическая генерация AI изображений',
    'Синхронизация прогресса чтения',
    'Персональная галерея изображений',
  ];

  return (
    <div
      className="min-h-screen grid grid-cols-1 lg:grid-cols-2"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Left Side - Login Form */}
      <div className="flex items-center justify-center p-8 lg:p-12 bg-background">
        <div className="max-w-md w-full">
          {/* Logo and Title */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-primary">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  fancai
                </h1>
              </div>
            </div>
            <h2 className="text-3xl font-bold mb-2 text-foreground">
              С возвращением!
            </h2>
            <p className="text-muted-foreground">
              Войдите, чтобы продолжить читать
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-2 text-foreground"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
                <input
                  {...register('email')}
                  type="email"
                  id="email"
                  placeholder="your@email.com"
                  className={cn(
                    'w-full pl-11 pr-4 py-3 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 bg-muted text-foreground',
                    errors.email ? 'border-red-500' : 'border-border'
                  )}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-2 text-foreground"
              >
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="********"
                  className={cn(
                    'w-full pl-11 pr-11 py-3 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 bg-muted text-foreground',
                    errors.password ? 'border-red-500' : 'border-border'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/70"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm hover:underline text-primary"
              >
                Забыли пароль?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full py-3 px-4 rounded-xl font-semibold text-white transition-all bg-primary hover:bg-primary/90',
                isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 shadow-lg'
              )}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Вход...</span>
                </div>
              ) : (
                'Войти'
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-8 text-center">
            <p className="text-muted-foreground">
              Нет аккаунта?{' '}
              <Link
                to="/register"
                className="font-semibold hover:underline text-primary"
              >
                Зарегистрироваться
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Gradient Benefits */}
      <div className="hidden lg:flex items-center justify-center p-12 relative overflow-hidden bg-gradient-to-br from-primary to-purple-600/90">
        <div className="relative z-10 max-w-md text-white">
          <div className="mb-8">
            <Sparkles className="w-16 h-16 mb-6" />
            <h2 className="text-4xl font-bold mb-4">
              Читайте с AI-визуализацией
            </h2>
            <p className="text-lg opacity-90">
              Каждое описание превращается в уникальное изображение благодаря искусственному интеллекту
            </p>
          </div>

          <div className="space-y-4">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5" />
                <p className="text-lg">{benefit}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl" />
      </div>
    </div>
  );
};

export default LoginPage;
