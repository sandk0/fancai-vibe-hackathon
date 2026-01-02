 
/**
 * RegisterPage - Modern redesign with split-screen layout
 *
 * Features:
 * - Split layout: form left, gradient right
 * - Full name + email + password fields
 * - Form validation
 * - Password strength indicator
 * - Theme-aware design
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye,
  EyeOff,
  BookOpen,
  Mail,
  Lock,
  User,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { notify } from '@/stores/ui';
import { getErrorMessage } from '@/utils/errors';
import { cn } from '@/lib/utils';

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
    email: z.string().email('Неправильный email адрес'),
    password: z
      .string()
      .min(12, 'Пароль должен содержать минимум 12 символов')
      .max(72, 'Пароль не может быть длиннее 72 символов')
      .regex(/[a-z]/, 'Пароль должен содержать строчные буквы')
      .regex(/[A-Z]/, 'Пароль должен содержать заглавные буквы')
      .regex(/\d/, 'Пароль должен содержать цифры')
      .regex(/[^a-zA-Z0-9]/, 'Пароль должен содержать специальные символы')
      .refine(
        (pwd) => !/(\d)\1{2,}/.test(pwd) && !/012|123|234|345|456|567|678|789/.test(pwd),
        'Пароль не должен содержать последовательные цифры (123, 456 и т.д.)'
      )
      .refine(
        (pwd) => new TextEncoder().encode(pwd).length <= 72,
        'Пароль слишком длинный при кодировании (макс. 72 байта). Используйте меньше спецсимволов.'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
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
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch('password');

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let strength = 0;

    // Length requirements (12+ chars required)
    if (pwd.length >= 12) strength++;
    if (pwd.length >= 16) strength++;

    // Required complexity
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;

    // Bonus: no sequential numbers
    const hasSequential = /(\d)\1{2,}/.test(pwd) || /012|123|234|345|456|567|678|789/.test(pwd);
    if (!hasSequential && pwd.length >= 12) strength++;

    return Math.min(strength, 4);
  };

  const passwordStrength = getPasswordStrength(password);
  const strengthLabels = ['Очень слабый', 'Слабый', 'Средний', 'Хороший', 'Отличный'];
  const strengthColors = ['#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e'];

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser(data.email, data.password, data.fullName);
      notify.success('Регистрация успешна!', 'Добро пожаловать в fancai');
      navigate('/library', { replace: true });
    } catch (error) {
      notify.error('Ошибка регистрации', getErrorMessage(error, 'Попробуйте снова'));
    }
  };

  const benefits = [
    'Бесплатная регистрация',
    'Неограниченная загрузка книг',
    'AI генерация изображений',
    'Синхронизация между устройствами',
  ];

  return (
    <div
      className="min-h-screen grid grid-cols-1 lg:grid-cols-2"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Left Side - Register Form */}
      <div className="flex items-center justify-center p-8 lg:p-12 overflow-y-auto bg-background">
        <div className="max-w-md w-full">
          {/* Logo and Title */}
          <div className="mb-8">
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
              Создать аккаунт
            </h2>
            <p className="text-muted-foreground">
              Начните свое путешествие в мир AI-визуализации
            </p>
          </div>

          {/* Register Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Full Name Field */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium mb-2 text-foreground"
              >
                Полное имя
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
                <input
                  {...register('fullName')}
                  type="text"
                  id="fullName"
                  placeholder="Иван Иванов"
                  className={cn(
                    'w-full pl-11 pr-4 py-3 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 bg-muted text-foreground',
                    errors.fullName ? 'border-red-500' : 'border-border'
                  )}
                />
              </div>
              {errors.fullName && (
                <p className="mt-1 text-sm text-red-500">{errors.fullName.message}</p>
              )}
            </div>

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
              <p className="text-xs mb-2 text-muted-foreground">
                Минимум 12 символов, включая заглавные, строчные буквы, цифры и спецсимволы
              </p>
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
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all"
                        style={{
                          backgroundColor:
                            i < passwordStrength ? strengthColors[passwordStrength] : '#e5e7eb',
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: strengthColors[passwordStrength] }}>
                    {strengthLabels[passwordStrength]}
                  </p>
                </div>
              )}
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium mb-2 text-foreground"
              >
                Подтвердите пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
                <input
                  {...register('confirmPassword')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  placeholder="********"
                  className={cn(
                    'w-full pl-11 pr-11 py-3 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 bg-muted text-foreground',
                    errors.confirmPassword ? 'border-red-500' : 'border-border'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/70"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full py-3 px-4 rounded-xl font-semibold text-white transition-all mt-6 bg-primary hover:bg-primary/90',
                isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 shadow-lg'
              )}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Регистрация...</span>
                </div>
              ) : (
                'Создать аккаунт'
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              Уже есть аккаунт?{' '}
              <Link
                to="/login"
                className="font-semibold hover:underline text-primary"
              >
                Войти
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
            <h2 className="text-4xl font-bold mb-4">Присоединяйтесь к читателям</h2>
            <p className="text-lg opacity-90">
              Откройте новый способ чтения с AI-визуализацией каждого описания
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

export default RegisterPage;
