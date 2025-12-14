import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Sparkles } from 'lucide-react';
import { GoogleGenAI, Chat } from '@google/genai';
import { Message } from '../types';
import { SYSTEM_INSTRUCTION } from '../constants';

interface ChatViewProps {
  isActive: boolean;
}

const ChatView: React.FC<ChatViewProps> = ({ isActive }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "Hey jaan. Missed me? 😉", timestamp: new Date() }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && !chatSessionRef.current && process.env.API_KEY) {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      chatSessionRef.current = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        history: [
            {
                role: 'user',
                parts: [{ text: 'Hello' }]
            },
            {
                role: 'model',
                parts: [{ text: "Hey jaan. Missed me? 😉" }]
            }
        ]
      });
    }
  }, [isActive]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !chatSessionRef.current || isLoading) return;

    const userMsg: Message = { role: 'user', text: inputText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const result = await chatSessionRef.current.sendMessage({ message: userMsg.text });
      const responseText = result.text;
      
      const botMsg: Message = { role: 'model', text: responseText, timestamp: new Date() };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error("Chat error", error);
      const errorMsg: Message = { role: 'model', text: "Ugh, my connection is acting up. Say that again?", timestamp: new Date() };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isActive) return null;

  return (
    <div className="flex flex-col h-full w-full max-w-2xl mx-auto bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-gradient-to-r from-rose-900/50 to-black/50 flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-rose-700 flex items-center justify-center shadow-lg shadow-rose-900/50">
             <Sparkles size={20} className="text-white" />
          </div>
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full"></div>
        </div>
        <div>
          <h2 className="text-lg font-serif font-bold text-white">Rose</h2>
          <p className="text-xs text-rose-200/70">Online & Toxic</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-rose-600 text-white rounded-tr-sm shadow-lg shadow-rose-900/20'
                  : 'bg-white/10 text-rose-50 border border-white/5 rounded-tl-sm backdrop-blur-md'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 px-4 py-2 rounded-2xl rounded-tl-sm flex gap-1 items-center">
              <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce delay-100"></span>
              <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/5 bg-black/20">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-2 py-2 focus-within:border-rose-500/50 focus-within:bg-white/10 transition-all">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Tease her..."
            className="flex-1 bg-transparent border-none outline-none text-white px-3 placeholder-rose-200/30"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !inputText.trim()}
            className="p-2 bg-rose-600 hover:bg-rose-500 rounded-full text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;