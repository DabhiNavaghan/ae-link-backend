'use client';

import React, { ButtonHTMLAttributes, forwardRef, CSSProperties } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
  fullWidth?: boolean;
}

const getVariantStyle = (variant: string): CSSProperties => {
  const baseStyle: CSSProperties = {
    fontWeight: 500,
    opacity: undefined,
  };

  const variantStyles: Record<string, CSSProperties> = {
    primary: {
      backgroundColor: 'var(--color-primary)',
      color: 'var(--color-bg)',
    },
    secondary: {
      backgroundColor: 'var(--color-secondary)',
      color: 'var(--color-bg)',
    },
    outline: {
      border: '2px solid var(--color-primary)',
      color: 'var(--color-primary)',
      backgroundColor: 'transparent',
    },
    ghost: {
      color: 'var(--color-text-secondary)',
      backgroundColor: 'transparent',
    },
    danger: {
      backgroundColor: 'var(--color-danger)',
      color: 'var(--color-bg)',
    },
  };

  return { ...baseStyle, ...variantStyles[variant] };
};

const getSizeStyle = (size: string): CSSProperties => {
  const sizeStyles: Record<string, CSSProperties> = {
    sm: { padding: '0.375rem 0.75rem', fontSize: '0.875rem' },
    md: { padding: '0.5rem 1rem', fontSize: '0.875rem' },
    lg: { padding: '0.75rem 1.5rem', fontSize: '1rem' },
  };

  return sizeStyles[size] || sizeStyles['md'];
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      children,
      fullWidth = false,
      disabled,
      className = '',
      style = {},
      ...props
    },
    ref
  ) => {
    const baseClasses = 'btn-base focus-ring';

    const combinedStyle: CSSProperties = {
      ...getVariantStyle(variant),
      ...getSizeStyle(size),
      width: fullWidth ? '100%' : undefined,
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      ...(style as CSSProperties),
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={baseClasses + (className ? ` ${className}` : '')}
        style={combinedStyle}
        {...props}
      >
        <span className="flex items-center justify-center gap-2">
          {isLoading && (
            <svg
              className="w-4 h-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {children}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
