import React, { useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

// Lightweight GPU-only pure-white ambient studio backdrop (ZERO scroll lag!)
export function AnimatedWhiteBackdrop() {
  const reduce = useReducedMotion();
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden -z-10 select-none"
    >
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {!reduce && (
        <>
          <motion.div
            animate={{ x: [0, 48, 0], y: [0, -24, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
            className="will-change-transform absolute -top-28 -left-20 h-96 w-96 rounded-full bg-blue-100/70 blur-3xl"
          />
          <motion.div
            animate={{ x: [0, -52, 0], y: [0, 28, 0] }}
            transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
            className="will-change-transform absolute -top-20 right-0 h-96 w-96 rounded-full bg-indigo-100/65 blur-3xl"
          />
          <motion.div
            animate={{ x: [0, 32, 0], y: [0, 20, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
            className="will-change-transform absolute top-32 left-1/3 h-72 w-72 rounded-full bg-sky-100/60 blur-3xl"
          />
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}

export function MotionReveal({ children, delay = 0, className = '' }) {
  const shouldReduce = useReducedMotion();
  if (shouldReduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`will-change-transform ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({ eyebrow, title, highlight, subtitle, align = 'left' }) {
  const center = align === 'center';
  return (
    <div className={`mb-6 ${center ? 'text-center mx-auto max-w-4xl' : 'w-full'}`}>
      {eyebrow && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3.5 py-1 text-xs font-bold tracking-wide text-blue-700 mb-3">
          {eyebrow}
        </span>
      )}
      <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
        {title}{' '}
        {highlight && (
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 bg-clip-text text-transparent">
            {highlight}
          </span>
        )}
      </h2>
      {subtitle && (
        <p className={`mt-2 text-sm sm:text-base text-slate-600 leading-relaxed ${center ? 'mx-auto max-w-3xl' : 'max-w-4xl'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function AccordionItem({ question, answer, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm sm:text-base font-bold text-slate-900 hover:bg-slate-50 transition-colors"
      >
        <span>{question}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-blue-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-5 pb-4 pt-2 text-sm text-slate-600 border-t border-slate-100 leading-relaxed">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ToastNotification({ toast }) {
  if (!toast) return null;
  const Icon =
    toast.tone === 'error' ? AlertTriangle : toast.tone === 'success' ? CheckCircle2 : Info;
  const ring =
    toast.tone === 'error'
      ? 'border-rose-300 bg-white text-rose-700 shadow-rose-100'
      : toast.tone === 'success'
      ? 'border-emerald-300 bg-white text-emerald-700 shadow-emerald-100'
      : 'border-blue-300 bg-white text-blue-700 shadow-blue-100';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 right-5 z-[95] flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs sm:text-sm font-semibold shadow-xl ${ring}`}
    >
      <Icon size={17} className="shrink-0" />
      <span>{toast.message}</span>
    </motion.div>
  );
}
