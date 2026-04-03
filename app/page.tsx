import CanvasEditor from '@/components/CanvasEditor';
import { Sparkles, Zap, Shield, MousePointer2 } from 'lucide-react';

export default function Home() {
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
        
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            <Shield className="w-3 h-3" />
            Secure AI Processing
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full text-center mb-12 space-y-6">
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
        </div>

        {/* Main Editor Component */}
        <div className="w-full max-w-7xl">
          <CanvasEditor />
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full mt-24 border-t border-zinc-900 pt-16">
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
