import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { MessageSquare, ArrowRight, CheckCircle, Mail, Key, Sun, Moon } from 'lucide-react';

export const Login: React.FC = () => {
  const { requestOtp, verifyOtp } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Handle countdown timer for resending OTP
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    const res = await requestOtp(email);
    setLoading(false);

    if (res.success) {
      setStep('otp');
      setSuccessMsg(res.message);
      setResendCooldown(60); // 60s cooldown limit from backend key
    } else {
      setError(res.message);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await verifyOtp(email, otp);
    setLoading(false);

    if (!res.success) {
      setError(res.message);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError('');
    const res = await requestOtp(email);
    setLoading(false);
    if (res.success) {
      setSuccessMsg("A new code was sent to your email.");
      setResendCooldown(60);
    } else {
      setError(res.message);
    }
  };

  return (
    <div className={`relative min-h-[100dvh] flex items-center justify-center px-4 py-8 sm:py-12 overflow-x-hidden overflow-y-auto transition-colors duration-300 ${
      theme === 'dark' ? 'bg-[#0b0f19]' : 'bg-[#f0f2f5]'
    }`}>
      {/* Theme Toggle Button Top Right */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className={`p-2 sm:p-2.5 rounded-xl border transition-all ${
            theme === 'dark'
              ? 'bg-[#111827]/80 text-amber-300 border-white/10 hover:bg-white/10'
              : 'bg-white text-indigo-600 border-gray-200 shadow-md hover:bg-gray-50'
          }`}
        >
          {theme === 'dark' ? <Sun className="w-4.5 h-4.5 sm:w-5 sm:h-5" /> : <Moon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />}
        </button>
      </div>

      {/* Background visual effects */}
      <div className={`absolute top-1/4 left-1/4 w-72 sm:w-96 h-72 sm:h-96 rounded-full blur-[100px] sm:blur-[120px] pointer-events-none ${
        theme === 'dark' ? 'bg-indigo-500/10' : 'bg-indigo-400/20'
      }`}></div>
      <div className={`absolute bottom-1/4 right-1/4 w-72 sm:w-96 h-72 sm:h-96 rounded-full blur-[100px] sm:blur-[120px] pointer-events-none ${
        theme === 'dark' ? 'bg-purple-500/10' : 'bg-purple-400/20'
      }`}></div>

      <div className="w-full max-w-md z-10 my-auto">
        {/* Header / Logo */}
        <div className="flex flex-col items-center justify-center text-center mb-6 sm:mb-8 fade-in">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-3 sm:mb-4 animate-pulse">
            <MessageSquare className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <h1 className={`text-3xl sm:text-4xl font-extrabold tracking-tight font-display ${
            theme === 'dark'
              ? 'bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent'
              : 'text-gray-900'
          }`}>
            ChatSphere
          </h1>
          <p className={`text-xs sm:text-sm mt-1.5 sm:mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Real-time, security-focused microservice messaging
          </p>
        </div>

        {/* Form Card */}
        <div className={`rounded-2xl sm:rounded-3xl p-6 sm:p-8 relative shadow-2xl overflow-hidden fade-in border transition-all ${
          theme === 'dark'
            ? 'glass-panel glow-indigo border-white/10'
            : 'bg-white border-gray-200 shadow-xl'
        }`}>
          {error && (
            <div className={`mb-6 p-4 rounded-xl text-sm font-medium animate-shake ${
              theme === 'dark'
                ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}>
              {error}
            </div>
          )}

          {successMsg && (
            <div className={`mb-6 p-4 rounded-xl text-sm flex items-start gap-2.5 ${
              theme === 'dark'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            }`}>
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    disabled={loading}
                    className={`w-full pl-11 pr-4 py-3 border rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      theme === 'dark'
                        ? 'bg-[#111827]/60 border-white/10 text-white placeholder-gray-500'
                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                    }`}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#0b0f19] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="otp" className={`block text-xs font-semibold uppercase tracking-wider ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setOtp('');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline transition-all font-medium"
                  >
                    Change Email
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                    <Key className="w-5 h-5" />
                  </div>
                  <input
                    id="otp"
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit OTP"
                    disabled={loading}
                    className={`w-full pl-11 pr-4 py-3 border rounded-xl text-center tracking-[0.5em] font-mono text-lg transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      theme === 'dark'
                        ? 'bg-[#111827]/60 border-white/10 text-white placeholder-gray-500'
                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                    }`}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#0b0f19] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Verify Code & Login</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className={`text-sm ${
                    resendCooldown > 0 
                      ? 'text-gray-400 cursor-not-allowed' 
                      : 'text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline font-medium'
                  } transition-all`}
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Verification Code'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
