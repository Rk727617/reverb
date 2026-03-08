/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, Upload, Download, RotateCcw, 
  Volume2, Music, Sliders, Zap, Waves
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AudioEngine } from './services/audioEngine';
import { AudioState, INITIAL_STATE, PRESETS, Preset } from './types';

export default function App() {
  const [state, setState] = useState<AudioState>(INITIAL_STATE);
  const [isExporting, setIsExporting] = useState(false);
  const engineRef = useRef<AudioEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    engineRef.current = new AudioEngine();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      engineRef.current?.stop();
    };
  }, []);

  // Visualizer loop
  useEffect(() => {
    if (!canvasRef.current || !engineRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const analyser = engineRef.current.getAnalyser();
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#8b5cf6');
        gradient.addColorStop(1, '#d946ef');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  }, []);

  // Sync state with engine
  useEffect(() => {
    const interval = setInterval(() => {
      if (engineRef.current && state.isPlaying) {
        setState(prev => ({
          ...prev,
          currentTime: engineRef.current!.getCurrentTime(),
          duration: engineRef.current!.getDuration()
        }));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [state.isPlaying]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && engineRef.current) {
      const buffer = await engineRef.current.loadAudio(file);
      setState(prev => ({
        ...prev,
        fileName: file.name,
        duration: buffer.duration,
        currentTime: 0,
        isPlaying: false
      }));
    }
  };

  const togglePlay = () => {
    if (!engineRef.current || !state.fileName) return;
    if (state.isPlaying) {
      engineRef.current.pause();
    } else {
      engineRef.current.play(state.speed);
    }
    setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (engineRef.current) {
      engineRef.current.seek(val / 100);
      setState(prev => ({ ...prev, currentTime: val / 100 * prev.duration }));
    }
  };

  const updateEffect = (key: keyof AudioState, value: number) => {
    setState(prev => ({ ...prev, [key]: value }));
    if (!engineRef.current) return;

    switch (key) {
      case 'speed': engineRef.current.setSpeed(value); break;
      case 'volume': engineRef.current.setVolume(value); break;
      case 'reverb': engineRef.current.setReverb(value); break;
      case 'bass': engineRef.current.setBass(value); break;
    }
  };

  const applyPreset = (preset: Preset) => {
    setState(prev => ({
      ...prev,
      speed: preset.speed,
      reverb: preset.reverb,
      pitch: preset.pitch,
      bass: preset.bass
    }));
    
    if (engineRef.current) {
      engineRef.current.setSpeed(preset.speed);
      engineRef.current.setReverb(preset.reverb);
      engineRef.current.setBass(preset.bass);
    }
  };

  const handleExport = async () => {
    if (!engineRef.current || !state.fileName) return;
    setIsExporting(true);
    try {
      const blob = await engineRef.current.exportWav(state.speed, state.reverb, state.bass);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.fileName.split('.')[0]}_processed.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-purple rounded-2xl shadow-lg shadow-brand-purple/20">
            <Waves className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Slowed & Reverb <span className="text-brand-purple">Studio Pro</span>
            </h1>
            <p className="text-slate-400 text-sm">Professional Audio Processing</p>
          </div>
        </div>
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all glass group"
        >
          <Upload className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
          <span>Upload Audio</span>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept="audio/*"
          />
        </button>
      </header>

      {/* Main Content */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Visualizer & Player */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass rounded-3xl p-6 aspect-video relative overflow-hidden flex flex-col justify-between">
            <canvas 
              ref={canvasRef} 
              className="absolute inset-0 w-full h-full opacity-40 pointer-events-none"
              width={800}
              height={400}
            />
            
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-xs font-mono uppercase tracking-widest text-brand-purple font-bold">Now Playing</span>
                  <h2 className="text-xl font-semibold truncate max-w-[250px]">
                    {state.fileName || "No file selected"}
                  </h2>
                </div>
                <Music className="w-6 h-6 text-white/20" />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono w-10">{formatTime(state.currentTime)}</span>
                  <input 
                    type="range" 
                    className="flex-1"
                    min="0"
                    max="100"
                    value={state.duration ? (state.currentTime / state.duration) * 100 : 0}
                    onChange={handleSeek}
                  />
                  <span className="text-xs font-mono w-10">{formatTime(state.duration)}</span>
                </div>

                <div className="flex justify-center items-center gap-8">
                  <button className="p-2 text-white/40 hover:text-white transition-colors">
                    <RotateCcw className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={togglePlay}
                    disabled={!state.fileName}
                    className="w-16 h-16 flex items-center justify-center bg-brand-purple rounded-full shadow-xl shadow-brand-purple/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {state.isPlaying ? <Pause className="w-8 h-8 fill-white" /> : <Play className="w-8 h-8 fill-white ml-1" />}
                  </button>
                  <div className="flex items-center gap-2 group">
                    <Volume2 className="w-5 h-5 text-white/40 group-hover:text-white" />
                    <input 
                      type="range" 
                      className="w-20"
                      min="0"
                      max="1"
                      step="0.01"
                      value={state.volume}
                      onChange={(e) => updateEffect('volume', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Presets */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-400">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-semibold uppercase tracking-wider">Quick Presets</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="px-4 py-3 rounded-xl glass hover:bg-brand-purple/20 hover:border-brand-purple/50 transition-all text-sm font-medium"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass rounded-3xl p-8 space-y-8">
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <Sliders className="w-5 h-5 text-brand-purple" />
              <h3 className="font-bold text-lg">Effect Controls</h3>
            </div>

            <div className="space-y-6">
              <ControlSlider 
                label="Playback Speed" 
                value={state.speed} 
                min={0.5} 
                max={1.5} 
                step={0.01}
                unit="x"
                onChange={(v) => updateEffect('speed', v)}
              />
              <ControlSlider 
                label="Reverb Intensity" 
                value={state.reverb} 
                min={0} 
                max={1} 
                step={0.01}
                unit="%"
                onChange={(v) => updateEffect('reverb', v)}
              />
              <ControlSlider 
                label="Bass Boost" 
                value={state.bass} 
                min={0} 
                max={20} 
                step={0.5}
                unit="dB"
                onChange={(v) => updateEffect('bass', v)}
              />
            </div>

            <button 
              onClick={handleExport}
              disabled={!state.fileName || isExporting}
              className="w-full py-4 bg-white text-brand-dark font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-brand-purple hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
            >
              {isExporting ? (
                <div className="w-5 h-5 border-2 border-brand-dark border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              {isExporting ? "Processing..." : "Export High Quality WAV"}
            </button>
          </div>

          <div className="glass rounded-2xl p-4 text-center">
            <p className="text-xs text-slate-500">
              All processing happens locally in your browser. No data is sent to any server.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-slate-500 text-sm">
        <p>&copy; 2024 Slowed & Reverb Studio Pro. Built with Web Audio API.</p>
      </footer>
    </div>
  );
}

function ControlSlider({ label, value, min, max, step, unit, onChange }: { 
  label: string, 
  value: number, 
  min: number, 
  max: number, 
  step: number,
  unit: string,
  onChange: (v: number) => void 
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded text-brand-purple font-bold">
          {unit === '%' ? Math.round(value * 100) : value.toFixed(2)}{unit}
        </span>
      </div>
      <input 
        type="range" 
        className="w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
