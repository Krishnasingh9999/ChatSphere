import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sparkles, User, ArrowRight, Sun, Moon } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { user, updateProfileName } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const handleSkipOrKeep = () => {
    localStorage.setItem(`aether_onboarded_${user._id}`, 'true');
    onComplete();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a display name.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await updateProfileName(name.trim());
    setLoading(false);

    if (res.success) {
      localStorage.setItem(`aether_onboarded_${user._id}`, 'true');
      onComplete();
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

      {/* Visual background lights */}
      <div className={`absolute top-1/4 left-1/4 w-72 sm:w-96 h-72 sm:h-96 rounded-full blur-[100px] sm:blur-[120px] pointer-events-none animate-pulse ${
        theme === 'dark' ? 'bg-indigo-500/10' : 'bg-indigo-400/20'
      }`}></div>
      <div className={`absolute bottom-1/4 right-1/4 w-72 sm:w-96 h-72 sm:h-96 rounded-full blur-[100px] sm:blur-[120px] pointer-events-none animate-pulse ${
        theme === 'dark' ? 'bg-purple-500/10' : 'bg-purple-400/20'
      }`}></div>

      <div className="w-full max-w-md z-10 my-auto fade-in">
        {/* Logo / Header */}
        <div className="flex flex-col items-center justify-center text-center mb-6 sm:mb-8">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-3 sm:mb-4">
            <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-white animate-spin-slow" />
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-display ${
            theme === 'dark'
              ? 'bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent'
              : 'text-gray-900'
          }`}>
            Welcome to ChatSphere
          </h1>
          <p className={`text-xs sm:text-sm mt-1.5 sm:mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Let's customize your secure workspace profile
          </p>
        </div>

        {/* Form Card */}
        <div className={`rounded-2xl sm:rounded-3xl p-6 sm:p-8 relative shadow-2xl overflow-hidden border transition-all ${
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <span className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Registered Email
              </span>
              <div className={`w-full px-4 py-3 border rounded-xl text-sm select-none truncate ${
                theme === 'dark'
                  ? 'bg-[#111827]/40 border-white/5 text-gray-400'
                  : 'bg-gray-100 border-gray-200 text-gray-700'
              }`}>
                {user.email}
              </div>
            </div>

            <div>
              <label htmlFor="display-name" className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Pick Your Display Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <User className="w-5 h-5" />
                </div>
                <input
                  id="display-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`e.g. ${user.email.slice(0, 8)}`}
                  maxLength={30}
                  disabled={loading}
                  className={`w-full pl-11 pr-4 py-3 border rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    theme === 'dark'
                      ? 'bg-[#111827]/60 border-white/10 text-white placeholder-gray-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
                  required
                />
              </div>
              <p className={`text-[10px] mt-1.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                This is how other users will find you in the directory.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#0b0f19] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Save & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSkipOrKeep}
                className={`w-full py-2.5 px-4 text-xs font-medium rounded-xl border transition-all ${
                  theme === 'dark'
                    ? 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border-white/5'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 border-gray-200'
                }`}
              >
                Keep current name ({user.name})
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
