/**
 * Customer app UI primitives.
 *
 * Every colour, radius and shadow here comes from the `@theme` tokens in
 * src/index.css. Surfaces use `bg-surface` / `text-ink` / `border-line`, which
 * are wired to CSS variables that flip on the `.dark` class, so these
 * components are theme-aware without a `dark:` variant at each call site.
 *
 * Import as:  import { Button, Card, BottomSheet } from '../components/ui';
 */
import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Loader2, X } from 'lucide-react';

const MotionDiv = motion.div;

const cx = (...parts) => parts.filter(Boolean).join(' ');

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

const BUTTON_VARIANTS = {
  primary: 'bg-brand text-white shadow-soft hover:brightness-105',
  secondary: 'bg-surface text-ink border border-line shadow-soft hover:bg-surface-sunken',
  subtle: 'bg-surface-sunken text-ink border border-transparent hover:border-line',
  ghost: 'bg-transparent text-ink-soft hover:text-ink',
  danger: 'bg-rose-500 text-white shadow-soft hover:bg-rose-600',
};

const BUTTON_SIZES = {
  sm: 'h-9 px-3.5 text-xs gap-1.5 rounded-control',
  md: 'h-11 px-5 text-sm gap-2 rounded-control',
  lg: 'h-14 px-6 text-base gap-2.5 rounded-card',
};

export const Button = ({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled = false,
  leftIcon = null,
  rightIcon = null,
  className = '',
  children,
  ...rest
}) => (
  <button
    type={rest.type || 'button'}
    disabled={disabled || loading}
    className={cx(
      'inline-flex items-center justify-center font-bold tracking-tight transition-all',
      'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
      BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary,
      BUTTON_SIZES[size] || BUTTON_SIZES.md,
      block && 'w-full',
      className,
    )}
    {...rest}
  >
    {loading ? <Loader2 size={16} className="animate-spin" /> : leftIcon}
    {children}
    {!loading && rightIcon}
  </button>
);

/* -------------------------------------------------------------------------- */
/* Card                                                                      */
/* -------------------------------------------------------------------------- */

export const Card = ({ padded = true, className = '', children, ...rest }) => (
  <div
    className={cx(
      'bg-surface border border-line rounded-card-lg shadow-card',
      padded && 'p-4',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

/* -------------------------------------------------------------------------- */
/* Fields                                                                     */
/* -------------------------------------------------------------------------- */

const FieldShell = ({ label, hint, error, className = '', children }) => (
  <label className={cx('block', className)}>
    {label && (
      <span className="mb-1.5 block text-2xs font-black uppercase tracking-[0.2em] text-ink-faint">
        {label}
      </span>
    )}
    {children}
    {error ? (
      <span className="mt-1.5 block text-xs font-bold text-rose-500">{error}</span>
    ) : hint ? (
      <span className="mt-1.5 block text-xs font-medium text-ink-faint">{hint}</span>
    ) : null}
  </label>
);

// `ds-field` opts the element out of the legacy `.user-app-theme input` overrides.
const FIELD_BASE =
  'ds-field w-full border rounded-control text-sm font-semibold text-ink transition-colors outline-none';

export const Input = ({ label, hint, error, leftIcon, className = '', wrapperClassName = '', ...rest }) => (
  <FieldShell label={label} hint={hint} error={error} className={wrapperClassName}>
    <span className="relative block">
      {leftIcon && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
          {leftIcon}
        </span>
      )}
      <input
        className={cx(FIELD_BASE, 'h-12', leftIcon ? 'pl-11 pr-4' : 'px-4', className)}
        {...rest}
      />
    </span>
  </FieldShell>
);

export const Select = ({ label, hint, error, className = '', wrapperClassName = '', children, ...rest }) => (
  <FieldShell label={label} hint={hint} error={error} className={wrapperClassName}>
    <span className="relative block">
      <select className={cx(FIELD_BASE, 'h-12 appearance-none pl-4 pr-10', className)} {...rest}>
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
      />
    </span>
  </FieldShell>
);

export const Textarea = ({ label, hint, error, rows = 4, className = '', wrapperClassName = '', ...rest }) => (
  <FieldShell label={label} hint={hint} error={error} className={wrapperClassName}>
    <textarea rows={rows} className={cx(FIELD_BASE, 'resize-none px-4 py-3', className)} {...rest} />
  </FieldShell>
);

/* -------------------------------------------------------------------------- */
/* Overlays                                                                   */
/* -------------------------------------------------------------------------- */

const useEscape = (open, onClose) => {
  useEffect(() => {
    if (!open || !onClose) return undefined;
    const handler = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
};

const OverlayHeader = ({ title, subtitle, onClose }) => {
  if (!title && !onClose) return null;

  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        {title && <h3 className="text-lg font-black leading-tight text-ink">{title}</h3>}
        {subtitle && <p className="mt-1 text-xs font-bold text-ink-faint">{subtitle}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-surface-sunken text-ink-soft transition-transform active:scale-90"
        >
          <X size={16} strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
};

export const BottomSheet = ({ open, onClose, title, subtitle, className = '', children }) => {
  useEscape(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <MotionDiv
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            role="dialog"
            aria-modal="true"
            className={cx(
              'relative z-10 w-full max-w-lg bg-surface text-ink border-t border-line',
              'rounded-t-sheet px-5 pt-3 pb-8 shadow-sheet max-h-[88vh] overflow-y-auto',
              className,
            )}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-pill bg-line" />
            <OverlayHeader title={title} subtitle={subtitle} onClose={onClose} />
            {children}
          </MotionDiv>
        </div>
      )}
    </AnimatePresence>
  );
};

export const Modal = ({ open, onClose, title, subtitle, className = '', children }) => {
  useEscape(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <MotionDiv
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 24 }}
            role="dialog"
            aria-modal="true"
            className={cx(
              'relative z-10 w-full max-w-sm bg-surface text-ink border border-line',
              'rounded-sheet p-6 shadow-premium max-h-[88vh] overflow-y-auto',
              className,
            )}
          >
            <OverlayHeader title={title} subtitle={subtitle} onClose={onClose} />
            {children}
          </MotionDiv>
        </div>
      )}
    </AnimatePresence>
  );
};

/* -------------------------------------------------------------------------- */
/* Skeleton / Badge / EmptyState                                              */
/* -------------------------------------------------------------------------- */

export const Skeleton = ({ lines = 0, className = '' }) => {
  if (lines > 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cx(
              'h-2.5 animate-pulse rounded-pill bg-surface-sunken',
              index === lines - 1 ? 'w-4/5' : 'w-full',
              className,
            )}
          />
        ))}
      </div>
    );
  }

  return <div className={cx('animate-pulse rounded-pill bg-surface-sunken', className)} />;
};

const BADGE_TONES = {
  neutral: 'bg-surface-sunken text-ink-soft',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
  danger: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
};

export const Badge = ({ tone = 'neutral', icon = null, className = '', children }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-2xs font-black uppercase tracking-wider',
      BADGE_TONES[tone] || BADGE_TONES.neutral,
      className,
    )}
  >
    {icon}
    {children}
  </span>
);

export const EmptyState = ({ icon: Icon, title, description, action = null, className = '' }) => (
  <div className={cx('flex flex-col items-center justify-center gap-4 py-16 text-center', className)}>
    {Icon && (
      <div className="flex h-20 w-20 items-center justify-center rounded-card-lg bg-surface-sunken border border-line">
        <Icon size={32} strokeWidth={1.6} className="text-ink-faint" />
      </div>
    )}
    <div>
      {title && <p className="text-base font-black text-ink">{title}</p>}
      {description && <p className="mt-1 text-xs font-bold text-ink-faint">{description}</p>}
    </div>
    {action}
  </div>
);
