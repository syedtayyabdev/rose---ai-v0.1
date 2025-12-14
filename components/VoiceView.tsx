import React, { useEffect, useRef } from 'react';
import { Mic, PhoneOff, Activity } from 'lucide-react';
import { useLiveSession } from '../hooks/useLiveSession';

interface VoiceViewProps {
  isActive: boolean;
}

const VoiceView: React.FC<VoiceViewProps> = ({ isActive }) => {
  const { isConnected, isSpeaking, connect, disconnect, error, analysers } = useLiveSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  // Auto-connect management
  useEffect(() => {
    return () => {
        if (!isActive && isConnected) {
            disconnect();
        }
    };
  }, [isActive, isConnected, disconnect]);

  // Advanced Visualizer
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        timeRef.current += 0.01;

        if (isConnected) {
            const activeAnalyser = isSpeaking ? analysers.output.current : analysers.input.current;
            let dataArray = new Uint8Array(0);
            
            if (activeAnalyser) {
                const bufferLength = activeAnalyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
                activeAnalyser.getByteFrequencyData(dataArray);
            }

            // Calculate Frequency Bands
            let bass = 0;
            let mids = 0;
            let treble = 0;

            if (dataArray.length > 0) {
                // Approximate bands for 256/512 FFT
                const range = dataArray.length;
                for(let i = 0; i < range; i++) {
                    const val = dataArray[i];
                    if (i < range * 0.1) bass += val;
                    else if (i < range * 0.5) mids += val;
                    else treble += val;
                }
                bass /= (range * 0.1);
                mids /= (range * 0.4);
                treble /= (range * 0.5);
            }
            
            // Normalize (0-1)
            const nBass = bass / 255;
            const nMids = mids / 255;
            const nTreble = treble / 255;
            
            // --- DRAWING ---

            // Dynamic Colors based on Tone
            // More treble = whiter/brighter. Bass = darker red.
            const r = 225 + (nTreble * 30);
            const g = 29 + (nMids * 50); 
            const b = 72 + (nTreble * 100);
            const colorCore = `rgba(${r}, ${g}, ${b}, 0.8)`;
            const colorGlow = `rgba(${r}, ${g}, ${b}, 0)`;
            
            // Radius modulation
            const baseRadius = 60 + (nBass * 40);
            
            // 1. Outer Glow
            const gradient = ctx.createRadialGradient(cx, cy, baseRadius * 0.5, cx, cy, baseRadius * 2 + (nBass * 50));
            gradient.addColorStop(0, colorCore);
            gradient.addColorStop(1, colorGlow);
            
            ctx.beginPath();
            ctx.arc(cx, cy, baseRadius * 2, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // 2. Fluid Blob (Multiple layers of sine waves)
            // We draw a closed loop where radius r = base + noise
            
            const drawBlob = (radius: number, color: string, speed: number, offset: number, spikes: number) => {
                ctx.beginPath();
                ctx.fillStyle = color;
                for (let i = 0; i <= 360; i+= 2) {
                    const angle = (i * Math.PI) / 180;
                    // Noise function using sine superposition
                    const noise = Math.sin(angle * spikes + timeRef.current * speed + offset) * 
                                  Math.cos(angle * 3 + timeRef.current * (speed * 1.5));
                    
                    // Modify amplitude by frequency bands
                    const amp = 10 + (nMids * 30) + (nTreble * 20 * noise);
                    const r = radius + (noise * amp);
                    
                    const x = cx + Math.cos(angle) * r;
                    const y = cy + Math.sin(angle) * r;
                    
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
            };

            // Layer 1: Darker, reacts to Bass
            drawBlob(baseRadius, `rgba(159, 18, 57, 0.8)`, 2, 0, 5); 
            
            // Layer 2: Lighter, reacts to Mids/Treble
            // If Rose is speaking, this layer is more active
            if (isSpeaking) {
                 drawBlob(baseRadius * 0.8, `rgba(244, 63, 94, 0.9)`, 4, Math.PI, 8 + (nTreble * 10));
            } else {
                 drawBlob(baseRadius * 0.8, `rgba(244, 63, 94, 0.5)`, 1, Math.PI, 3);
            }

            // 3. Circular Waveform (Ring)
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + nTreble})`;
            ctx.lineWidth = 2;
            const ringRadius = baseRadius * 1.5;
            
            for (let i = 0; i <= 360; i++) {
                const angle = (i * Math.PI) / 180;
                // Map frequency data index to angle
                const dataIndex = Math.floor((i / 360) * (dataArray.length / 2)); 
                const val = dataArray[dataIndex] || 0;
                const offset = (val / 255) * 20 * nTreble; // Only punch out on highs
                
                const r = ringRadius + offset;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();

        } else {
            // Idle state
            ctx.beginPath();
            ctx.arc(cx, cy, 50, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, 60, 0, Math.PI * 2);
            ctx.stroke();
        }

        animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationRef.current);
  }, [isConnected, isSpeaking, analysers]);

  if (!isActive) return null;

  return (
    <div className="flex flex-col h-full w-full max-w-2xl mx-auto bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
      
      {/* Visualizer Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        
        {/* Status Text Overlay */}
        <div className="z-10 text-center mt-64 pointer-events-none">
             <h2 className="text-3xl font-serif font-bold text-white mb-2 drop-shadow-lg">
                {isConnected ? (isSpeaking ? "Rose" : "Listening...") : "Rose"}
             </h2>
             <p className="text-rose-200/60 text-sm drop-shadow-md">
                {isConnected ? "Live Voice Call" : "Tap the mic to start"}
             </p>
        </div>
      </div>

      {/* Controls */}
      <div className="p-8 flex justify-center items-center gap-8 z-10 pb-16">
        {!isConnected ? (
             <button 
                onClick={connect}
                className="w-20 h-20 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-[0_0_30px_rgba(225,29,72,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_50px_rgba(225,29,72,0.6)]"
             >
                <Mic size={36} />
             </button>
        ) : (
            <>
                <button 
                    onClick={disconnect}
                    className="w-16 h-16 rounded-full bg-red-600/80 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 backdrop-blur-sm border border-white/10"
                >
                    <PhoneOff size={28} />
                </button>
            </>
        )}
      </div>

      {/* Error Toast */}
      {error && (
        <div className="absolute top-4 left-0 right-0 mx-auto w-max px-6 py-3 bg-red-950/90 text-red-200 rounded-full text-sm border border-red-800 backdrop-blur-md shadow-xl animate-in fade-in slide-in-from-top-4">
            {error}
        </div>
      )}
    </div>
  );
};

export default VoiceView;