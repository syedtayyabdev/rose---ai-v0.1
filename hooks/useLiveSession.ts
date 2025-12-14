import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { SYSTEM_INSTRUCTION, ROSE_VOICE_NAME } from '../constants';
import { createPcmBlob, decodeBase64, decodeAudioData } from '../utils/audio';

export const useLiveSession = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Audio Contexts
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  
  // Analysers for Visualization
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);

  // Audio Queue Management
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // GenAI Session
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const clientRef = useRef<GoogleGenAI | null>(null);

  const cleanup = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    scheduledSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    scheduledSourcesRef.current.clear();
    
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (outputContextRef.current) {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }

    inputAnalyserRef.current = null;
    outputAnalyserRef.current = null;

    setIsConnected(false);
    setIsSpeaking(false);
    setVolume(0);
    nextStartTimeRef.current = 0;
  }, []);

  const connect = useCallback(async () => {
    if (!process.env.API_KEY) {
      setError("API Key missing");
      return;
    }

    try {
      setError(null);
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      // Input Context & Analyser
      inputContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      inputAnalyserRef.current = inputContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 512;
      inputAnalyserRef.current.smoothingTimeConstant = 0.5;

      // Output Context & Analyser
      outputContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      outputAnalyserRef.current = outputContextRef.current.createAnalyser();
      outputAnalyserRef.current.fftSize = 512;
      outputAnalyserRef.current.smoothingTimeConstant = 0.5;
      // Connect output analyser to destination so we can hear it
      outputAnalyserRef.current.connect(outputContextRef.current.destination);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      clientRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: ROSE_VOICE_NAME } },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      };

      const callbacks = {
        onopen: () => {
          console.log("Live Session Opened");
          setIsConnected(true);
          
          if (!inputContextRef.current || !audioStreamRef.current) return;
          
          const source = inputContextRef.current.createMediaStreamSource(audioStreamRef.current);
          sourceNodeRef.current = source;
          
          // Connect to Analyser
          if (inputAnalyserRef.current) {
              source.connect(inputAnalyserRef.current);
          }
          
          const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
          scriptProcessorRef.current = processor;
          
          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            
            // Calculate volume for simple state feedback
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);
            setVolume(prev => Math.max(0.1, prev * 0.8 + rms * 2));

            const pcmBlob = createPcmBlob(inputData);
            
            if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then(session => {
                    session.sendRealtimeInput({ media: pcmBlob });
                }).catch(err => console.error("Send input error", err));
            }
          };
          
          source.connect(processor);
          processor.connect(inputContextRef.current.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          
          if (base64Audio && outputContextRef.current) {
            setIsSpeaking(true);
            const ctx = outputContextRef.current;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
            
            try {
                const audioBuffer = await decodeAudioData(
                    decodeBase64(base64Audio),
                    ctx,
                    24000,
                    1
                );
                
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                
                // Connect to Analyser (which is connected to destination)
                if (outputAnalyserRef.current) {
                    source.connect(outputAnalyserRef.current);
                } else {
                    source.connect(ctx.destination);
                }
                
                source.addEventListener('ended', () => {
                    scheduledSourcesRef.current.delete(source);
                    if (scheduledSourcesRef.current.size === 0) {
                        setIsSpeaking(false);
                    }
                });
                
                source.start(nextStartTimeRef.current);
                scheduledSourcesRef.current.add(source);
                nextStartTimeRef.current += audioBuffer.duration;
            } catch (err) {
                console.error("Audio decode error", err);
            }
          }

          if (message.serverContent?.interrupted) {
            console.log("Model interrupted");
            scheduledSourcesRef.current.forEach(s => {
                try { s.stop(); } catch(e){}
            });
            scheduledSourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            setIsSpeaking(false);
          }
        },
        onclose: () => {
          console.log("Live Session Closed");
          cleanup();
        },
        onerror: (err: any) => {
          console.error("Live Session Error", err);
          setError("Connection error. Please try again.");
          cleanup();
        }
      };

      sessionPromiseRef.current = clientRef.current.live.connect({
        ...config,
        callbacks
      });

    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to connect microphone");
      cleanup();
    }
  }, [cleanup]);

  return {
    isConnected,
    isSpeaking,
    volume,
    connect,
    disconnect: cleanup,
    error,
    analysers: {
        input: inputAnalyserRef,
        output: outputAnalyserRef
    }
  };
};