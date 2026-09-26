import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'dark' | 'light';

export type ChatColorTheme = 
  | 'indigo' 
  | 'emerald' 
  | 'cyan' 
  | 'rose' 
  | 'amber' 
  | 'violet' 
  | 'crimson' 
  | 'teal';

export interface ChatThemeConfig {
  id: ChatColorTheme;
  name: string;
  nameHindi: string;
  dotColor: string;
  sentBubble: string; // Tailwind gradient for sent messages
  sendButton: string; // Tailwind gradient for send button
  accentText: string;
  accentBg: string;
  accentBorder: string;
  focusRing: string;
  shadowGlow: string;
  ambientLight: string;
  ambientDark: string;
}

export const CHAT_THEME_PRESETS: Record<ChatColorTheme, ChatThemeConfig> = {
  indigo: {
    id: 'indigo',
    name: 'Classic Indigo',
    nameHindi: 'क्लासिक इंडिगो',
    dotColor: '#6366f1',
    sentBubble: 'from-indigo-600 to-purple-600',
    sendButton: 'from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700',
    accentText: 'text-indigo-500 dark:text-indigo-400',
    accentBg: 'bg-indigo-600',
    accentBorder: 'border-indigo-500',
    focusRing: 'focus:ring-indigo-500',
    shadowGlow: 'shadow-indigo-500/20',
    ambientLight: 'bg-indigo-400/10',
    ambientDark: 'bg-indigo-500/10',
  },
  emerald: {
    id: 'emerald',
    name: 'WhatsApp Emerald',
    nameHindi: 'व्हाट्सएप एमराल्ड',
    dotColor: '#10b981',
    sentBubble: 'from-emerald-600 to-teal-600',
    sendButton: 'from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700',
    accentText: 'text-emerald-500 dark:text-emerald-400',
    accentBg: 'bg-emerald-600',
    accentBorder: 'border-emerald-500',
    focusRing: 'focus:ring-emerald-500',
    shadowGlow: 'shadow-emerald-500/20',
    ambientLight: 'bg-emerald-400/10',
    ambientDark: 'bg-emerald-500/10',
  },
  cyan: {
    id: 'cyan',
    name: 'Ocean Cyan',
    nameHindi: 'ओशन सियान',
    dotColor: '#06b6d4',
    sentBubble: 'from-cyan-600 to-blue-600',
    sendButton: 'from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700',
    accentText: 'text-cyan-500 dark:text-cyan-400',
    accentBg: 'bg-cyan-600',
    accentBorder: 'border-cyan-500',
    focusRing: 'focus:ring-cyan-500',
    shadowGlow: 'shadow-cyan-500/20',
    ambientLight: 'bg-cyan-400/10',
    ambientDark: 'bg-cyan-500/10',
  },
  rose: {
    id: 'rose',
    name: 'Sunset Rose',
    nameHindi: 'सनसेट रोज़',
    dotColor: '#f43f5e',
    sentBubble: 'from-rose-500 to-pink-600',
    sendButton: 'from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700',
    accentText: 'text-rose-500 dark:text-rose-400',
    accentBg: 'bg-rose-500',
    accentBorder: 'border-rose-500',
    focusRing: 'focus:ring-rose-500',
    shadowGlow: 'shadow-rose-500/20',
    ambientLight: 'bg-rose-400/10',
    ambientDark: 'bg-rose-500/10',
  },
  amber: {
    id: 'amber',
    name: 'Golden Amber',
    nameHindi: 'गोल्डन एम्बर',
    dotColor: '#f59e0b',
    sentBubble: 'from-amber-500 to-orange-600',
    sendButton: 'from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700',
    accentText: 'text-amber-500 dark:text-amber-400',
    accentBg: 'bg-amber-500',
    accentBorder: 'border-amber-500',
    focusRing: 'focus:ring-amber-500',
    shadowGlow: 'shadow-amber-500/20',
    ambientLight: 'bg-amber-400/10',
    ambientDark: 'bg-amber-500/10',
  },
  violet: {
    id: 'violet',
    name: 'Midnight Violet',
    nameHindi: 'मिडनाइट वायलेट',
    dotColor: '#8b5cf6',
    sentBubble: 'from-violet-600 to-fuchsia-600',
    sendButton: 'from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700',
    accentText: 'text-violet-500 dark:text-violet-400',
    accentBg: 'bg-violet-600',
    accentBorder: 'border-violet-500',
    focusRing: 'focus:ring-violet-500',
    shadowGlow: 'shadow-violet-500/20',
    ambientLight: 'bg-violet-400/10',
    ambientDark: 'bg-violet-500/10',
  },
  crimson: {
    id: 'crimson',
    name: 'Ruby Crimson',
    nameHindi: 'रूबी क्रिम्सन',
    dotColor: '#ef4444',
    sentBubble: 'from-red-600 to-rose-600',
    sendButton: 'from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700',
    accentText: 'text-red-500 dark:text-red-400',
    accentBg: 'bg-red-600',
    accentBorder: 'border-red-500',
    focusRing: 'focus:ring-red-500',
    shadowGlow: 'shadow-red-500/20',
    ambientLight: 'bg-red-400/10',
    ambientDark: 'bg-red-500/10',
  },
  teal: {
    id: 'teal',
    name: 'Mint Teal',
    nameHindi: 'मिंट टील',
    dotColor: '#14b8a6',
    sentBubble: 'from-teal-500 to-emerald-600',
    sendButton: 'from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700',
    accentText: 'text-teal-500 dark:text-teal-400',
    accentBg: 'bg-teal-500',
    accentBorder: 'border-teal-500',
    focusRing: 'focus:ring-teal-500',
    shadowGlow: 'shadow-teal-500/20',
    ambientLight: 'bg-teal-400/10',
    ambientDark: 'bg-teal-500/10',
  },
};

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  chatTheme: ChatColorTheme;
  setChatTheme: (chatTheme: ChatColorTheme) => void;
  chatThemeConfig: ChatThemeConfig;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('app_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  const [chatTheme, setChatThemeState] = useState<ChatColorTheme>(() => {
    try {
      const saved = localStorage.getItem('chat_color_theme') as ChatColorTheme;
      if (saved && CHAT_THEME_PRESETS[saved]) return saved;
      return 'indigo';
    } catch {
      return 'indigo';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('app_theme', theme);
    } catch (e) {
      console.error('Failed to save theme to localStorage:', e);
    }

    const root = document.documentElement;
    const body = document.body;

    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      body.classList.add('dark');
      body.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      body.classList.add('light');
      body.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem('chat_color_theme', chatTheme);
    } catch (e) {
      console.error('Failed to save chatTheme to localStorage:', e);
    }
  }, [chatTheme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setChatTheme = (newChatTheme: ChatColorTheme) => {
    if (CHAT_THEME_PRESETS[newChatTheme]) {
      setChatThemeState(newChatTheme);
    }
  };

  const chatThemeConfig = CHAT_THEME_PRESETS[chatTheme] || CHAT_THEME_PRESETS.indigo;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        chatTheme,
        setChatTheme,
        chatThemeConfig,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

