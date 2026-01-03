/**
 * LoginPage - Mobile-first centered login form
 *
 * Features:
 * - Mobile-first centered design
 * - Touch-friendly inputs (44px minimum)
 * - Password visibility toggle
 * - Loading state on submit button
 * - Error handling with toast notifications
 * - Uses CSS custom properties from Phase 1
 */

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, BookOpen } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { notify } from '@/stores/ui';
import { Input } from '@/components/UI/Input';
import { Button } from '@/components/UI/button';

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

  const from = (location.state as { from?: string })?.from || '/library';

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

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        backgroundColor: 'var(--color-bg-base)',
        paddingTop: 'max(env(safe-area-inset-top), 2rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)',
      }}
    >
      <div className="w-full max-w-sm">
        {/* Logo/Brand */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ backgroundColor: 'var(--color-accent-600)' }}
          >
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-default)' }}
          >
            fancai
          </h1>
        </div>

        {/* Title */}
        <h2
          className="text-xl font-semibold text-center mb-6"
          style={{ color: 'var(--color-text-default)' }}
        >
          Вход в аккаунт
        </h2>

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email Input */}
          <Input
            {...register('email')}
            type="email"
            label="Email"
            placeholder="your@email.com"
            leftIcon={<Mail />}
            error={errors.email?.message}
            autoComplete="email"
            inputSize="md"
          />

          {/* Password Input */}
          <Input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            label="Пароль"
            placeholder="********"
            leftIcon={<Lock />}
            error={errors.password?.message}
            autoComplete="current-password"
            inputSize="md"
            rightIcon={
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="flex items-center justify-center focus:outline-none"
                style={{ color: 'var(--color-text-subtle)' }}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            }
          />

          {/* Forgot Password Link */}
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm font-medium transition-colors hover:underline"
              style={{ color: 'var(--color-accent-600)' }}
            >
              Забыли пароль?
            </Link>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isLoading}
            loadingText="Вход..."
          >
            Войти
          </Button>
        </form>

        {/* Register Link */}
        <p
          className="mt-8 text-center text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Нет аккаунта?{' '}
          <Link
            to="/register"
            className="font-semibold transition-colors hover:underline"
            style={{ color: 'var(--color-accent-600)' }}
          >
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
