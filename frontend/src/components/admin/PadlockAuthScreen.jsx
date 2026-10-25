import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  KeyRound,
  ShieldAlert,
  Delete,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  Fingerprint,
  ShieldCheck,
  Timer,
  Mail,
  Sparkles,
} from 'lucide-react';
import { UltraApi } from '../../services/apiClient';

const DEFAULT_PIN_LENGTH = 14;
const CUBE_ICON = '/brand/cube-tunnel-256.png';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * ShakeelAdminProDownloader — Pro-Security two-gate login.
 *
 * Gate 1 : owner PIN (any length the server reports, 14 by default)
 * Gate 2 : e-mail + master password + 6-digit Pro-Security code
 *
 * Nothing is pre-filled and nothing is stored on the device except the short
 * lived padlock ticket issued by the server.
 */
export function PadlockAuthScreen({ onAuthenticated }) {
  const [step, setStep] = useState(1);
  const [pinLength, setPinLength] = useState(DEFAULT_PIN_LENGTH);
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockSeconds, setLockSeconds] = useState(0);
  const pinInputRef = useRef(null);
  const autoSubmittedRef = useRef('');

  useEffect(() => {
    let mounted = true;
    UltraApi.getAdminLoginHints()
      .then((hints) => {
        if (!mounted) return;
        if (Number(hints?.pinLength) >= 4) setPinLength(Number(hints.pinLength));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (lockSeconds <= 0) return undefined;
    const timer = setInterval(() => setLockSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [lockSeconds]);

  const pinDots = useMemo(() => Array.from({ length: pinLength }, (_, i) => i < pin.length), [
    pinLength,
    pin,
  ]);

  const handleError = (err) => {
    const remaining = Number(err?.details?.remainingSeconds || 0);
    if (err?.code === 'ADMIN_IP_BANNED_30M' && remaining > 0) setLockSeconds(remaining);
    setErrorMsg(err?.message || 'Verification failed.');
    setPin('');
  };

  const handlePinVerify = async (pinValue) => {
    const candidate = String(pinValue ?? pin).replace(/\D/g, '');
    if (!candidate) return;
    setLoading(true);
    setErrorMsg('');
    try {
      await UltraApi.verifyPin(candidate);
      setStep(2);
      setPin('');
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const pressDigit = (digit) => {
    if (loading || lockSeconds > 0) return;
    setErrorMsg('');
    setPin((prev) => (prev.length >= pinLength ? prev : prev + digit));
  };

  // Auto-submit exactly once when the full PIN is entered (typed, pasted or
  // tapped on the keypad) — never twice, not even under React StrictMode.
  useEffect(() => {
    if (step !== 1 || loading) return;
    if (pin.length !== pinLength) return;
    if (autoSubmittedRef.current === pin) return;
    autoSubmittedRef.current = pin;
    handlePinVerify(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, pinLength, step, loading]);

  const handleCredentialsLogin = async (e) => {
    e.preventDefault();
    if (lockSeconds > 0) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await UltraApi.loginAdmin({
        email: email.trim(),
        password,
        totpCode: totpCode.replace(/\D/g, ''),
      });
      onAuthenticated(res.admin || res);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080512] text-slate-200 flex items-center justify-center px-4 py-10">
      {/* Ambient neon tunnel */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-fuchsia-600/25 blur-[130px]" />
        <div className="absolute bottom-[-220px] right-[-120px] h-[520px] w-[520px] rounded-full bg-violet-600/25 blur-[140px]" />
        <div className="absolute left-[-160px] top-1/3 h-[380px] w-[380px] rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="ud-grid-glow absolute inset-0 opacity-[0.13]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative w-full max-w-md rounded-3xl border border-violet-500/25 bg-[#0C0819]/85 p-6 sm:p-8 shadow-[0_30px_90px_rgba(88,28,135,0.45)] backdrop-blur-xl"
      >
        <div className="text-center mb-6">
          <motion.div
            initial={{ rotate: -8, scale: 0.9 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className="relative mx-auto mb-3 h-20 w-20"
          >
            <span className="absolute inset-0 rounded-2xl bg-violet-500/30 blur-xl" />
            <img
              src={CUBE_ICON}
              alt="ShakeelAdminProDownloader cube tunnel"
              className="relative h-20 w-20 rounded-2xl object-cover ring-1 ring-violet-400/30 ud-float-slow"
            />
            <span className="absolute -bottom-2 -right-2 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-lg">
              {step === 1 ? <Lock size={15} /> : <KeyRound size={15} />}
            </span>
          </motion.div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-fuchsia-300">
            <ShieldCheck size={12} /> Pro Security · Gate {step} of 2
          </span>

          <h1 className="font-display mt-2 text-xl font-extrabold text-white">
            ShakeelAdminProDownloader
          </h1>
          <p className="mt-1 text-xs text-violet-200/70">
            {step === 1
              ? 'Enter the private digital keypad PIN to open the tunnel.'
              : 'Master credentials + 6-digit Pro-Security code.'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-950/60 p-3 text-xs text-rose-200">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-rose-400" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {lockSeconds > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/40 p-3 text-xs text-amber-200">
            <Timer size={16} className="shrink-0 text-amber-400" />
            <span>
              Locked for {Math.ceil(lockSeconds / 60)} more minute
              {Math.ceil(lockSeconds / 60) === 1 ? '' : 's'} ({lockSeconds}s) after 3 wrong attempts.
            </span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.form
              key="pin"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.2 }}
              onSubmit={(e) => {
                e.preventDefault();
                handlePinVerify();
              }}
            >
              <div className="mb-5 rounded-2xl border border-violet-500/20 bg-[#07040F] px-4 py-4">
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {pinDots.map((filled, idx) => (
                    <span
                      key={idx}
                      className={`h-2.5 w-2.5 rounded-full transition-all duration-150 ${
                        filled
                          ? 'scale-110 bg-fuchsia-400 shadow-[0_0_10px_#e879f9]'
                          : 'bg-slate-800 ring-1 ring-violet-500/25'
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/60">
                  {pin.length}/{pinLength} digits · digits only
                </p>
                <input
                  ref={pinInputRef}
                  value={pin}
                  onChange={(e) => {
                    setErrorMsg('');
                    setPin(e.target.value.replace(/\D/g, '').slice(0, pinLength));
                  }}
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label="Secret digital PIN"
                  placeholder="Type or paste the PIN"
                  className="mt-3 w-full rounded-xl border border-violet-500/20 bg-[#0B0717] px-3 py-2 text-center text-sm font-mono tracking-[0.35em] text-fuchsia-200 placeholder:text-violet-300/30 placeholder:tracking-normal focus:border-fuchsia-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {DIGITS.map((digit) => (
                  <motion.button
                    key={digit}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => pressDigit(digit)}
                    className="h-12 rounded-xl border border-violet-500/25 bg-gradient-to-b from-[#1A1033] to-[#120B26] text-base font-extrabold text-white transition-colors hover:border-fuchsia-400/60 hover:from-[#241447]"
                  >
                    {digit}
                  </motion.button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPin('');
                    setErrorMsg('');
                  }}
                  className="h-12 rounded-xl border border-violet-500/20 bg-[#120B26] text-[11px] font-bold text-rose-300 hover:bg-rose-950/50"
                >
                  CLEAR
                </button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => pressDigit('0')}
                  className="h-12 rounded-xl border border-violet-500/25 bg-gradient-to-b from-[#1A1033] to-[#120B26] text-base font-extrabold text-white hover:border-fuchsia-400/60"
                >
                  0
                </motion.button>
                <button
                  type="button"
                  onClick={() => setPin((p) => p.slice(0, -1))}
                  aria-label="Backspace"
                  className="flex h-12 items-center justify-center rounded-xl border border-violet-500/20 bg-[#120B26] text-violet-200 hover:bg-[#1B1136]"
                >
                  <Delete size={17} />
                </button>
              </div>

              <button
                type="submit"
                disabled={pin.length < 4 || loading || lockSeconds > 0}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 py-3 text-sm font-extrabold text-white shadow-[0_12px_30px_rgba(168,85,247,0.45)] transition-opacity disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Fingerprint size={16} className="animate-pulse" /> Verifying…
                  </>
                ) : (
                  <>
                    Unlock Gate 1 <ArrowRight size={16} />
                  </>
                )}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="credentials"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleCredentialsLogin}
              className="space-y-3.5"
            >
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                <CheckCircle2 size={15} />
                <span>Gate 1 verified — 10-minute padlock ticket issued</span>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-violet-200/80" htmlFor="admin-email">
                  Super-Admin e-mail
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-3 text-violet-400/70" />
                  <input
                    id="admin-email"
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your-admin@gmail.com"
                    className="w-full rounded-xl border border-violet-500/25 bg-[#07040F] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-violet-300/30 focus:border-fuchsia-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-violet-200/80" htmlFor="admin-password">
                  Master password
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPass ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-violet-500/25 bg-[#07040F] px-3 py-2.5 pr-10 text-sm text-white placeholder:text-violet-300/30 focus:border-fuchsia-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-2.5 text-violet-300/70 hover:text-white"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-violet-200/80" htmlFor="admin-2fa">
                  6-digit Pro-Security code
                </label>
                <input
                  id="admin-2fa"
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="189230"
                  className="w-full rounded-xl border border-violet-500/25 bg-[#07040F] px-3 py-2.5 font-mono text-sm font-bold tracking-[0.35em] text-fuchsia-200 placeholder:text-violet-300/25 placeholder:tracking-normal focus:border-fuchsia-400 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || lockSeconds > 0}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 py-3 text-sm font-extrabold text-white shadow-[0_12px_30px_rgba(168,85,247,0.45)] disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Sparkles size={16} className="animate-pulse" /> Authenticating…
                  </>
                ) : (
                  <>
                    Enter Command Center <ArrowRight size={16} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setPin('');
                  setErrorMsg('');
                }}
                className="w-full text-center text-[11px] font-bold text-violet-300/70 hover:text-white"
              >
                ← Back to the digital keypad
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <p className="mt-5 text-center text-[10px] leading-relaxed text-violet-300/45">
          Protected by a 3-strike IP lockout, hashed credentials, an 8-hour signed session and a
          full security audit trail. Credentials never touch the browser storage.
        </p>
      </motion.div>
    </div>
  );
}
