import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, KeyRound, ShieldAlert, Delete, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { UltraApi } from '../../services/apiClient';

export function PadlockAuthScreen({ onAuthenticated }) {
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('admin@ultradownloader.pro');
  const [password, setPassword] = useState('UltraAdmin@2026');
  const [totpCode, setTotpCode] = useState('123456');
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const pressDigit = (d) => {
    if (pin.length >= 6 || loading) return;
    setErrorMsg('');
    setPin((prev) => prev + d);
  };

  const handlePinVerify = async (e) => {
    e?.preventDefault();
    if (!pin) return;
    setLoading(true);
    setErrorMsg('');
    try {
      await UltraApi.verifyPin(pin);
      setStep(2);
    } catch (err) {
      setErrorMsg(err.message || 'Invalid PIN.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialsLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await UltraApi.loginAdmin({ email, password, totpCode });
      onAuthenticated(res.admin || res);
    } catch (err) {
      setErrorMsg(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="w-full max-w-md rounded-2xl bg-[#0B1220] border border-slate-800 p-6 sm:p-8 shadow-[0_24px_70px_rgba(0,0,0,0.6)]"
      >
        <div className="text-center mb-6">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-to-br from-[#1D6FF2] to-[#38BDF8] flex items-center justify-center text-white shadow-[0_10px_28px_rgba(29,111,242,0.5)] mb-3">
            {step === 1 ? <Lock size={26} /> : <KeyRound size={26} />}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-sky-400/25 px-3 py-0.5 text-[11px] font-bold text-sky-300">
            5-LAYER STEALTH PADLOCK · GATE {step} OF 2
          </span>
          <h1 className="font-display font-extrabold text-xl text-white mt-2">
            {step === 1 ? 'Enter Secret Digital PIN' : 'Master Executive Verification'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Protected by SQL 3-Strike Auto-Lockout (30-Minute IP Ban on Invalid Attempts)
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl bg-rose-950/80 border border-rose-500/50 p-3 flex items-start gap-2 text-xs text-rose-200">
            <ShieldAlert size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.form
            key="pin"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18 }}
            onSubmit={handlePinVerify}
          >
            <div className="rounded-2xl bg-[#060B18] border border-slate-800 py-4 px-4 flex items-center justify-center gap-3 mb-5">
              {[0, 1, 2, 3].map((idx) => (
                <span
                  key={idx}
                  className={`h-4 w-4 rounded-full transition-all ${
                    pin.length > idx
                      ? 'bg-[#38BDF8] scale-110 shadow-[0_0_12px_#38BDF8]'
                      : 'bg-slate-800 border border-slate-700'
                  }`}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => pressDigit(digit)}
                  className="h-12 rounded-xl bg-[#101C38] hover:bg-[#192C56] border border-slate-800 hover:border-sky-400/50 text-base font-extrabold text-white transition-all active:scale-95"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPin('')}
                className="h-12 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-800 text-xs font-bold text-rose-300"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => pressDigit('0')}
                className="h-12 rounded-xl bg-[#101C38] hover:bg-[#192C56] border border-slate-800 hover:border-sky-400/50 text-base font-extrabold text-white"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setPin((p) => p.slice(0, -1))}
                aria-label="Backspace"
                className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-center"
              >
                <Delete size={17} />
              </button>
            </div>

            <button
              type="submit"
              disabled={pin.length < 4 || loading}
              className="mt-5 w-full rounded-xl bg-[#1D6FF2] hover:bg-blue-500 disabled:opacity-50 py-3 text-sm font-extrabold text-white flex items-center justify-center gap-2 shadow-[0_10px_24px_rgba(29,111,242,0.45)]"
            >
              <span>{loading ? 'Verifying in SQL...' : 'Unlock Gate 1'}</span>
              <ArrowRight size={16} />
            </button>
          </motion.form>
        ) : (
          <motion.form
            key="cred"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18 }}
            onSubmit={handleCredentialsLogin}
            className="space-y-3.5"
          >
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={15} />
              <span>Gate 1 Verified — Padlock Ticket Issued</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Master Admin Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-[#060B18] border border-slate-800 focus:border-sky-400 px-3.5 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Master Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-[#060B18] border border-slate-800 focus:border-sky-400 px-3.5 py-2.5 pr-10 text-sm text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                6-Digit Authenticator 2FA Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="w-full rounded-xl bg-[#060B18] border border-slate-800 focus:border-sky-400 px-3.5 py-2.5 text-sm tracking-[0.3em] font-mono font-bold text-sky-300 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-[#1D6FF2] hover:bg-blue-500 py-3 text-sm font-extrabold text-white flex items-center justify-center gap-2 shadow-[0_10px_24px_rgba(29,111,242,0.5)]"
            >
              <span>{loading ? 'Authenticating...' : 'Enter Executive Command Center'}</span>
              <ArrowRight size={16} />
            </button>
          </motion.form>
        )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
