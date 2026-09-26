import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ChatLockProvider } from './context/ChatLockContext';
import { Login } from './components/Login';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './components/Dashboard';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const [onboarded, setOnboarded] = React.useState(false);

  if (loading) {
    return (
      <div className={`min-h-screen w-screen flex flex-col items-center justify-center gap-3 transition-colors duration-300 ${
        theme === 'light' ? 'bg-[#f0f2f5] text-gray-800' : 'bg-[#0b0f19] text-gray-100'
      }`}>
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <span className={`text-sm font-medium select-none tracking-wider ${
          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
        }`}>
          Initializing secure messaging session...
        </span>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const alreadyOnboarded = localStorage.getItem(`aether_onboarded_${user._id}`) === 'true';
  const isNewUser = user.name === user.email.slice(0, 8);

  if (isNewUser && !alreadyOnboarded && !onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />;
  }

  return (
    <SocketProvider>
      <Dashboard />
    </SocketProvider>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ChatLockProvider>
          <AppContent />
        </ChatLockProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

