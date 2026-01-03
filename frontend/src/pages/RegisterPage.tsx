/**
 * RegisterPage - Mobile-first centered form design
 *
 * Features:
 * - Mobile-first centered layout
 * - Phase 2 Input/Checkbox/Button components
 * - Touch-friendly (44px+ targets)
 * - Inline validation with react-hook-form
 * - Password strength indicator (Weak/Medium/Strong)
 * - Loading state on submit button
 * - Terms acceptance checkbox
 * - Link to Login page
 */

import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye,
  EyeOff,
  BookOpen,
  Mail,
  Lock,
  User,
  Check,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { notify } from '@/stores/ui';
import { getErrorMessage } from '@/utils/errors';
import { Input } from '@/components/UI/Input';
import { Button } from '@/components/UI/button';
import { Checkbox } from '@/components/UI/Checkbox';
import { cn } from '@/lib/utils';

/**
 * Password validation schema
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
    email: z.string().email('Введите корректный email адрес'),
    password: z
      .string()
      .min(8, 'Минимум 8 символов')
      .regex(/[a-z]/, 'Нужна строчная буква')
      .regex(/[A-Z]/, 'Нужна заглавная буква')
      .regex(/\d/, 'Нужна цифра')
      .regex(/[^a-zA-Z0-9]/, 'Нужен спецсимвол'),
    confirmPassword: z.string().min(1, 'Подтвердите пароль'),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'Необходимо принять условия',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Password strength levels
 */
type PasswordStrength = 'weak' | 'medium' | 'strong';

interface PasswordCriteria {
  minLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

/**
 * Calculate password strength based on criteria
 */
function getPasswordStrength(password: string): {
  strength: PasswordStrength;
  criteria: PasswordCriteria;
  score: number;
} {
  const criteria: PasswordCriteria = {
    minLength: password.length >= 8,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[^a-zA-Z0-9]/.test(password),
  };

  const score = Object.values(criteria).filter(Boolean).length;

  let strength: PasswordStrength;
  if (score <= 2) {
    strength = 'weak';
  } else if (score <= 4) {
    strength = 'medium';
  } else {
    strength = 'strong';
  }

  return { strength, criteria, score };
}

/**
 * Password strength indicator component
 */
const PasswordStrengthIndicator: React.FC<{
  password: string;
}> = ({ password }) => {
  const { strength, criteria, score } = useMemo(
    () => getPasswordStrength(password),
    [password]
  );

  if (!password) return null;

  const strengthConfig = {
    weak: {
      label: 'Слабый',
      color: 'var(--color-error)',
      bgColor: 'var(--color-error-muted)',
    },
    medium: {
      label: 'Средний',
      color: 'var(--color-warning)',
      bgColor: 'var(--color-warning-muted)',
    },
    strong: {
      label: 'Надежный',
      color: 'var(--color-success)',
      bgColor: 'var(--color-success-muted)',
    },
  };

  const config = strengthConfig[strength];

  return (
    <div className="mt-3 space-y-2">
      {/* Strength bar */}
      <div className="flex gap-1">
        {[1, 2, 3].map((level) => (
          <div
            key={level}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor:
                score >= level * 2 - 1 || (level === 1 && score >= 1)
                  ? config.color
                  : 'var(--color-border-default)',
            }}
          />
        ))}
      </div>

      {/* Strength label */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-medium"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
      </div>

      {/* Criteria checklist */}
      <div className="grid grid-cols-2 gap-1.5">
        <CriteriaItem met={criteria.minLength} label="8+ символов" />
        <CriteriaItem met={criteria.hasNumber} label="Цифра" />
        <CriteriaItem met={criteria.hasLowercase} label="Строчная" />
        <CriteriaItem met={criteria.hasSpecial} label="Спецсимвол" />
        <CriteriaItem met={criteria.hasUppercase} label="Заглавная" />
      </div>
    </div>
  );
};

/**
 * Individual criteria item
 */
const CriteriaItem: React.FC<{ met: boolean; label: string }> = ({
  met,
  label,
}) => (
  <div className="flex items-center gap-1.5">
    {met ? (
      <Check
        className="size-3.5 shrink-0"
        style={{ color: 'var(--color-success)' }}
      />
    ) : (
      <X
        className="size-3.5 shrink-0"
        style={{ color: 'var(--color-text-disabled)' }}
      />
    )}
    <span
      className="text-xs"
      style={{
        color: met ? 'var(--color-text-muted)' : 'var(--color-text-disabled)',
      }}
    >
      {label}
    </span>
  </div>
);

/**
 * Password toggle button component
 */
const PasswordToggle: React.FC<{
  show: boolean;
  onToggle: () => void;
}> = ({ show, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className={cn(
      'flex items-center justify-center',
      'min-h-[44px] min-w-[44px]',
      'text-[var(--color-text-subtle)]',
      'hover:text-[var(--color-text-default)]',
      'transition-colors duration-200',
      'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-500)] focus:ring-offset-2',
      'rounded-md'
    )}
    aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
  >
    {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
  </button>
);

const RegisterPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register: registerUser, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, touchedFields },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const password = watch('password');

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser(data.email, data.password, data.fullName);
      notify.success('Регистрация успешна!', 'Добро пожаловать в fancai');
      navigate('/library', { replace: true });
    } catch (error) {
      notify.error('Ошибка регистрации', getErrorMessage(error, 'Попробуйте снова'));
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        backgroundColor: 'var(--color-bg-subtle)',
        paddingTop: 'max(env(safe-area-inset-top), 2rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)',
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 sm:p-8 shadow-lg"
        style={{
          backgroundColor: 'var(--color-bg-base)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        {/* Logo and Brand */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="flex items-center justify-center w-14 h-14 rounded-xl mb-4"
            style={{ backgroundColor: 'var(--color-accent-600)' }}
          >
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-default)' }}
          >
            fancai
          </h1>
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <h2
            className="text-xl font-semibold mb-2"
            style={{ color: 'var(--color-text-default)' }}
          >
            Создать аккаунт
          </h2>
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Начните свое путешествие в мир AI-визуализации
          </p>
        </div>

        {/* Register Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Full Name Input */}
          <Input
            {...register('fullName')}
            label="Имя"
            placeholder="Иван Иванов"
            leftIcon={<User />}
            error={errors.fullName?.message}
            inputSize="md"
            autoComplete="name"
          />

          {/* Email Input */}
          <Input
            {...register('email')}
            type="email"
            label="Email"
            placeholder="your@email.com"
            leftIcon={<Mail />}
            error={errors.email?.message}
            inputSize="md"
            autoComplete="email"
          />

          {/* Password Input */}
          <div>
            <Input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              label="Пароль"
              placeholder="Минимум 8 символов"
              leftIcon={<Lock />}
              rightIcon={
                <PasswordToggle
                  show={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                />
              }
              error={touchedFields.password && errors.password ? errors.password.message : undefined}
              inputSize="md"
              autoComplete="new-password"
            />
            <PasswordStrengthIndicator password={password || ''} />
          </div>

          {/* Confirm Password Input */}
          <Input
            {...register('confirmPassword')}
            type={showConfirmPassword ? 'text' : 'password'}
            label="Подтверждение пароля"
            placeholder="Повторите пароль"
            leftIcon={<Lock />}
            rightIcon={
              <PasswordToggle
                show={showConfirmPassword}
                onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            }
            error={errors.confirmPassword?.message}
            inputSize="md"
            autoComplete="new-password"
          />

          {/* Terms Checkbox */}
          <Controller
            name="acceptTerms"
            control={control}
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                label="Согласен с условиями использования"
                variant={errors.acceptTerms ? 'error' : 'default'}
                errorMessage={errors.acceptTerms?.message}
              />
            )}
          />

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            loadingText="Регистрация..."
            className="w-full mt-6"
            disabled={isLoading}
          >
            Создать аккаунт
          </Button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Уже есть аккаунт?{' '}
            <Link
              to="/login"
              className="font-semibold transition-colors hover:underline"
              style={{ color: 'var(--color-accent-600)' }}
            >
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
