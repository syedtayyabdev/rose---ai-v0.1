import React, { useState } from 'react';
import { MessageSquare, Mic } from 'lucide-react';
import ChatView from './components/ChatView';
import VoiceView from './components/VoiceView';
import { AppMode } from './types';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.TEXT);

  return (
    <div className="min-h-screen bg-black text-white relative selection:bg-rose-900 selection:text-white">
      {/* Ambient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-rose-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-800/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 h-screen flex flex-col p-4 md:p-6 lg:p-8">
        
        {/* Navigation / Mode Switcher */}
        <div className="flex justify-center mb-6">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-1 rounded-full flex gap-1">
            <button
              onClick={() => setMode(AppMode.TEXT)}
              className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all ${
                mode === AppMode.TEXT
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/50'
                  : 'text-rose-200/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageSquare size={16} />
              Chat
            </button>
            <button
              onClick={() => setMode(AppMode.VOICE)}
              className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all ${
                mode === AppMode.VOICE
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/50'
                  : 'text-rose-200/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Mic size={16} />
              Call
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
             <ChatView isActive={mode === AppMode.TEXT} />
             <VoiceView isActive={mode === AppMode.VOICE} />
        </div>

        {/* Footer */}
        <div className="text-center mt-4">
            <p className="text-rose-200/20 text-xs font-light tracking-widest uppercase">
                Rose AI • {process.env.API_KEY ? "Connected" : "No API Key"}
            </p>
        </div>
      </div>
    </div>
  );
};

export default App;