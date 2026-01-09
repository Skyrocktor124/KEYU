import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Sparkles, RefreshCcw, Hand, Volume2, VolumeX } from 'lucide-react';
import HandManager from './components/HandManager';
import Scene3D from './components/Scene3D';
import { HandResults, Beat, GameState, LevelTheme } from './types';
import { DEFAULT_THEME, GAME_CONFIG } from './constants';
import * as GeminiService from './services/geminiService';

// Cyberpunk/Synthwave track URL (Royalty Free)
const MUSIC_URL = "https://cdn.pixabay.com/audio/2023/04/04/audio_98553483df.mp3"; 

// Audio Context for sound effects
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

const playHitSound = (freq: number) => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.1, audioCtx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; z: number } | null>(null);
  const [cursorScale, setCursorScale] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  // Game Objects
  const [beats, setBeats] = useState<Beat[]>([]);
  const [theme, setTheme] = useState<LevelTheme>(DEFAULT_THEME);
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Constants to map hand to screen
  // Increased range multiplier (Gain) to make movement more sensitive
  // Input 0..1 -> Output approx -15..15 (Screen visible is roughly -12..12)
  const mapHandToScreen = (x: number, y: number) => {
    return { 
      x: (1 - x) * 30 - 15, // Was * 20 - 10
      y: (1 - y) * 18 - 9,  // Was * 12 - 6
      z: 0 
    };
  };

  const handleHandResults = useCallback((results: HandResults) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];
      
      // Calculate cursor position
      setCursorPos(mapHandToScreen(indexTip.x, indexTip.y));
      
      // Calculate Pinch/Spread Distance for Scale
      const dist = Math.sqrt(
          Math.pow(indexTip.x - thumbTip.x, 2) + 
          Math.pow(indexTip.y - thumbTip.y, 2)
      );

      // Normalize distance to scale factor: 0.5 to 2.5
      // Decreased maxD from 0.25 to 0.15 to make it easier to reach max size
      const minD = 0.02;
      const maxD = 0.15; 
      const normalized = Math.min(Math.max((dist - minD) / (maxD - minD), 0), 1);
      const newScale = 0.5 + (normalized * 2.0);
      
      setCursorScale(newScale);

    } else {
      setCursorPos(null);
    }
  }, []);

  // Audio Manager
  useEffect(() => {
    if (audioRef.current) {
        if (gameState === GameState.PLAYING && !isMuted) {
            audioRef.current.play().catch(e => console.log("Audio play failed:", e));
        } else {
            audioRef.current.pause();
            if (gameState === GameState.MENU) {
                audioRef.current.currentTime = 0;
            }
        }
    }
  }, [gameState, isMuted]);

  // Game Loop for Spawning
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    const spawnInterval = setInterval(() => {
        setBeats(prev => {
            // Remove old beats that are far behind
            const active = prev.filter(b => b.z < GAME_CONFIG.DESPAWN_Z + 5 && !b.hit);
            
            // Spawn new beat?
            if (Math.random() > 0.3) { // 70% chance to spawn
                const lanes = [-4, 0, 4];
                const laneIdx = Math.floor(Math.random() * lanes.length);
                const x = lanes[laneIdx] + (Math.random() - 0.5) * 2;
                const y = (Math.random() - 0.5) * 4;
                
                active.push({
                    id: Date.now().toString() + Math.random(),
                    x,
                    y,
                    z: GAME_CONFIG.SPAWN_Z,
                    color: theme.colors[0],
                    hit: false,
                    lane: laneIdx
                });
            }
            return active;
        });
    }, 600 / theme.speedMultiplier); // Beat rate

    return () => clearInterval(spawnInterval);
  }, [gameState, theme]);

  const handleHit = (id: string) => {
    // This is called from the Scene3D frame loop
    // We update state here to reflect UI, but visuals handled in Scene
    setBeats(prev => prev.map(b => b.id === id ? { ...b, hit: true } : b));
    setScore(s => s + 100 + (combo * 10));
    setCombo(c => c + 1);
    playHitSound(440 + (combo * 20)); // Pitch up with combo
  };

  const handleMiss = (id: string) => {
    setCombo(0);
  };

  const generateNewTheme = async () => {
    if (!promptInput.trim()) return;
    setIsGenerating(true);
    const newTheme = await GeminiService.generateLevelTheme(promptInput);
    setTheme(newTheme);
    setIsGenerating(false);
  };

  const startGame = () => {
    setScore(0);
    setCombo(0);
    setBeats([]);
    setGameState(GameState.PLAYING);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white select-none">
      
      {/* Background Music */}
      <audio ref={audioRef} src={MUSIC_URL} loop />

      {/* 3D Layer */}
      <div className="absolute inset-0 z-0">
        <Scene3D 
          cursorPos={cursorPos}
          cursorScale={cursorScale}
          beats={beats}
          setBeats={setBeats}
          onHit={handleHit}
          onMiss={handleMiss}
          theme={theme}
          isPlaying={gameState === GameState.PLAYING}
        />
      </div>

      <HandManager onHandsDetected={handleHandResults} showCamera={true} />

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none p-8 flex flex-col justify-between">
        
        {/* Top Bar: Score */}
        <div className="flex justify-between items-start">
            <div className="text-4xl font-black italic tracking-tighter" style={{ color: theme.colors[0], textShadow: `0 0 20px ${theme.colors[1]}` }}>
                {score.toLocaleString()}
            </div>
            
            {gameState === GameState.PLAYING && (
                <div className="flex flex-col items-center">
                    <div className="text-6xl font-black text-yellow-400 animate-pulse">{combo > 1 ? `${combo}x` : ''}</div>
                    {combo > 5 && <div className="text-sm font-bold tracking-widest text-white uppercase">Combo!</div>}
                </div>
            )}

            <div className="text-right pointer-events-auto flex flex-col items-end gap-2">
                <button onClick={() => setIsMuted(!isMuted)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <h2 className="text-xl font-bold text-white">{theme.name}</h2>
                <p className="text-xs text-gray-300 max-w-[200px]">{theme.description}</p>
            </div>
        </div>

        {/* Menu Screen */}
        {gameState === GameState.MENU && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
                <div className="bg-slate-900/90 border border-white/20 p-8 rounded-2xl max-w-md w-full shadow-[0_0_50px_rgba(0,255,255,0.2)]">
                    <h1 className="text-4xl font-black text-center mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        NEON RHYTHM
                    </h1>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs uppercase font-bold text-gray-400">Generate Vibe</label>
                            <div className="flex gap-2 mt-1">
                                <input 
                                    type="text" 
                                    value={promptInput}
                                    onChange={e => setPromptInput(e.target.value)}
                                    placeholder="e.g. 'Cyberpunk Rain', 'Volcano'"
                                    className="flex-1 bg-black/50 border border-gray-600 rounded px-3 py-2 text-sm focus:border-blue-400 outline-none transition"
                                />
                                <button 
                                    onClick={generateNewTheme}
                                    disabled={isGenerating}
                                    className="p-2 bg-blue-600 hover:bg-blue-500 rounded transition disabled:opacity-50"
                                >
                                    {isGenerating ? <RefreshCcw className="animate-spin" size={18} /> : <Sparkles size={18} />}
                                </button>
                            </div>
                        </div>

                        <button 
                            onClick={startGame}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-lg group"
                        >
                            <Play className="fill-white group-hover:fill-yellow-200" /> START
                        </button>

                        <div className="flex flex-col items-center justify-center gap-1 text-xs text-gray-500 mt-4">
                            <div className="flex items-center gap-2">
                                <Hand size={14} />
                                <span>Move hand to slash</span>
                            </div>
                            <div>Open/Close fingers to resize Saber</div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Play/Stop controls for debug */}
        {gameState === GameState.PLAYING && (
             <div className="pointer-events-auto self-center">
                 <button onClick={() => setGameState(GameState.MENU)} className="bg-red-500/20 hover:bg-red-500/50 text-red-200 px-4 py-1 rounded text-xs border border-red-500/30">
                     STOP
                 </button>
             </div>
        )}

      </div>
    </div>
  );
};

export default App;