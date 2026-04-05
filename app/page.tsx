'use client';

import { useState, useRef, useEffect } from 'react';
import CanvasEditor from '@/components/CanvasEditor';
import { Sparkles, Zap, Shield, MousePointer2, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function Home() {
  const { user, signIn, logOut, loading } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-indigo-500/20 rounded-full animate-ping" />
          <div className="w-12 h-12 border-t-2 border-indigo-500 rounded-full animate-spin absolute inset-0" />
        </div>
      </main>
    );
  }

  if (user) {
    return (
      <main className="h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-50 flex flex-col">
        {/* Navigation / Header */}
        <nav className="h-16 border-b border-zinc-900 flex items-center justify-between px-6 lg:px-12 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap className="w-5 h-5 text-white fill-white" />
            </div>
            <span className="text-lg font-display font-bold tracking-tight">
              Studio<span className="text-indigo-500">Fill</span>
            </span>
          </div>
          
          <div className="flex items-center gap-4 md:gap-6">
            <div className="hidden md:flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              <Shield className="w-3 h-3" />
              Secure AI Processing
            </div>
            <div className="w-[1px] h-4 bg-zinc-800 hidden md:block" />
            <div className="flex items-center gap-3">
              <button onClick={logOut} className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
              <div className="relative" ref={profileRef}>
                <button 
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="focus:outline-none flex items-center justify-center"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-9 h-9 rounded-full border-2 border-zinc-800 hover:border-indigo-500 transition-colors" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                      {user.email?.[0].toUpperCase()}
                    </div>
                  )}
                </button>
                
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
                      <p className="text-sm font-bold text-zinc-100 truncate">{user.displayName || 'User'}</p>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{user.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Main Editor Component */}
        <div className="flex-1 flex flex-col w-full h-[calc(100vh-64px)]">
          <CanvasEditor />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      {/* Navigation / Header */}
      <nav className="h-16 border-b border-zinc-900 flex items-center justify-between px-6 lg:px-12 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <span className="text-lg font-display font-bold tracking-tight">
            Studio<span className="text-indigo-500">Fill</span>
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <button onClick={signIn} className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2">
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full text-center mb-16 space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-[10px] font-mono uppercase tracking-[0.2em]">
            <Sparkles className="w-3 h-3" />
            Next-Gen Generative AI
          </div>
          <h1 className="text-5xl sm:text-7xl font-display font-black tracking-tighter leading-[0.9]">
            REIMAGINE <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-500 to-purple-500">EVERY PIXEL</span>
          </h1>
          <p className="max-w-xl mx-auto text-sm sm:text-base text-zinc-500 leading-relaxed font-medium">
            Professional-grade generative fill in your browser. Highlight any area, describe your vision, and watch the AI bring it to life seamlessly.
          </p>
          <button onClick={signIn} className="mx-auto flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-500/20 text-lg">
            <Sparkles className="w-5 h-5" />
            Start Creating Now
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full mt-12 border-t border-zinc-900 pt-16">
          <div className="space-y-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
              <MousePointer2 className="w-5 h-5 text-indigo-500" />
            </div>
            <h3 className="text-sm font-bold text-zinc-200">Precision Brush</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Variable size and opacity controls for pixel-perfect area selection.
            </p>
          </div>
          <div className="space-y-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
              <Sparkles className="w-5 h-5 text-indigo-500" />
            </div>
            <h3 className="text-sm font-bold text-zinc-200">Context Aware</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              AI understands the surrounding pixels to ensure seamless blending.
            </p>
          </div>
          <div className="space-y-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
              <Zap className="w-5 h-5 text-indigo-500" />
            </div>
            <h3 className="text-sm font-bold text-zinc-200">Instant Results</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Powered by Gemini 2.5 Flash for rapid generation and high-quality output.
            </p>
          </div>
        </div>

        <footer className="mt-32 text-center space-y-4 pb-12">
          <div className="h-[1px] w-12 bg-zinc-800 mx-auto" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
            © 2026 StudioFill AI • Professional Creative Suite
          </p>
        </footer>
      </div>
    </main>
  );
}
