
import React, { useState, useEffect, useMemo } from 'react';
import { PlayerState, GlobalStats } from '../types';
import { Zap, Activity, Cpu, Box, Check, BrainCircuit } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { formatHashrate, formatHashValue } from '../constants';
import { GameService } from '../services/mockBackend';

interface MinerProps {
  playerState: PlayerState;
  globalStats: GlobalStats; // Add GlobalStats prop
  onMine: () => void;
}

const Miner: React.FC<MinerProps> = ({ playerState, globalStats, onMine }) => {
  const { t } = useLanguage();
  const [isClicking, setIsClicking] = useState(false);
  
  // Track previous blocks mined to trigger haptic feedback only
  const [prevBlocks, setPrevBlocks] = useState(globalStats.blockHeight);

  // Generate stars for warp effect
  const stars = useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: 0.5 + Math.random() * 1.5, // 0.5s - 2s speed
      delay: Math.random() * 2,
      size: Math.random() > 0.8 ? 2 : 1,
      color: Math.random() > 0.7 ? '#00F0FF' : Math.random() > 0.8 ? '#FF00E5' : '#FFFFFF',
      opacity: 0.3 + Math.random() * 0.7
    }));
  }, []);

  useEffect(() => {
    if (globalStats.blockHeight > prevBlocks) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        } else if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate([50, 50, 50]);
        }
        setPrevBlocks(globalStats.blockHeight);
    }
  }, [globalStats.blockHeight, prevBlocks]);

  // Use GLOBAL STATS for blockchain data
  const currentBlockHeight = 1 + globalStats.blockHeight;
  const progressPercent = Math.min((globalStats.currentBlockHash / globalStats.currentDifficulty) * 100, 100);
  
  const approxTonPrice = (playerState.balance * (globalStats.currentPrice || 0)).toFixed(2);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsClicking(true);
    onMine();
    
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    } else if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(10);
    }
    
    setTimeout(() => setIsClicking(false), 100);
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden">
      
      {/* COSMIC SPACE BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden perspective-500">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle,_rgba(141,115,255,0.08)_0%,_transparent_70%)] blur-[60px]"></div>
            
            <div className="absolute inset-0 preserve-3d">
                {stars.map((star) => (
                    <div 
                        key={star.id}
                        className="absolute rounded-full animate-warp"
                        style={{
                            left: `${star.left}%`,
                            top: `${star.top}%`,
                            width: `${star.size}px`,
                            height: `${star.size}px`,
                            backgroundColor: star.color,
                            boxShadow: `0 0 ${star.size + 2}px ${star.color}`,
                            animationDuration: `${star.duration}s`,
                            animationDelay: `-${star.delay}s`, 
                        }}
                    ></div>
                ))}
            </div>

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_30%,_#000000_100%)] opacity-80"></div>
      </div>

      {/* 1. Main Balance Display */}
      <div className="flex flex-col items-center text-center z-20 flex-shrink-0 relative pt-2">
        <span className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase mb-0.5">{t('miner.balance')}</span>
        <h1 className="text-5xl font-black font-mono tracking-tight text-white drop-shadow-[0_0_15px_rgba(0,240,255,0.4)]">
          <span className="gradient-text">{Math.floor(playerState.balance).toLocaleString()}</span>
        </h1>
        <p className="text-neuro-cyan/80 font-mono text-sm font-bold mt-0.5 tracking-wider">
            ≈ {approxTonPrice} TON
        </p>
      </div>

      {/* 2. Block Mining Strip (GLOBAL DATA) */}
      <div className="w-full px-6 flex flex-col gap-1 flex-shrink-0 z-10 mt-2 relative">
          <div className="flex justify-between items-end text-[10px] font-mono font-bold tracking-widest uppercase">
              <span className="text-neuro-violet flex items-center gap-1.5">
                 <Box size={12} className="text-neuro-violet" /> BLOCK #{currentBlockHeight}
              </span>
              <span className="text-slate-500 flex items-center gap-1">
                 DIFF <span className="text-white bg-white/10 px-1.5 rounded-[2px]">{formatHashValue(globalStats.currentDifficulty)}</span>
              </span>
          </div>

          <div className="h-1.5 w-full bg-[#1a1a1a] rounded-full overflow-hidden relative shadow-inner">
               <div 
                 className="h-full bg-neuro-gradient-primary relative transition-all duration-300 ease-out shadow-[0_0_8px_rgba(141,115,255,0.6)]"
                 style={{ width: `${progressPercent}%` }}
               ></div>
          </div>
      </div>

      {/* 3. 3D QUANTUM SPHERE MINER */}
      <div className="flex-1 flex flex-col justify-center items-center w-full relative z-10 perspective-1000 pb-60 pt-12">
        
        <div 
            className="relative w-64 h-64 cursor-pointer touch-none select-none group preserve-3d animate-float z-10"
            onPointerDown={handlePointerDown}
            style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-neuro-violet/30 rounded-full blur-[60px] transition-opacity duration-100 pointer-events-none ${isClicking ? 'opacity-80' : 'opacity-20'}`}></div>

          <div 
             className="w-full h-full relative preserve-3d transition-transform duration-100 ease-out"
             style={{ transform: isClicking ? 'scale3d(0.9, 0.9, 0.9)' : 'scale3d(1, 1, 1)' }}
          >
            {/* Core Sphere */}
            <div className={`absolute inset-[15%] rounded-full bg-radial-gradient from-neuro-cyan via-[#2a0044] to-black shadow-[inset_0_0_30px_rgba(0,240,255,0.5)] border-2 border-neuro-cyan/30 flex items-center justify-center overflow-hidden transition-all duration-100 ${isClicking ? 'brightness-150 shadow-[0_0_50px_rgba(0,240,255,0.6)]' : ''}`}>
                 <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-overlay"></div>
                 
                 <BrainCircuit 
                    size={42} 
                    className={`text-neuro-cyan drop-shadow-[0_0_15px_rgba(0,240,255,0.8)] transition-transform duration-100 ${isClicking ? 'scale-110' : 'scale-100'}`} 
                 />
            </div>

            {/* Rings */}
            <div className="absolute inset-0 preserve-3d animate-gyro-x">
                 <div className="absolute inset-0 rounded-full border-2 border-dashed border-neuro-violet/60 opacity-80"></div>
                 <div className="absolute inset-0 animate-[spin_2s_linear_infinite]">
                     <div className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_15px_white,0_0_30px_#8D73FF]"></div>
                 </div>
            </div>

            <div className="absolute inset-4 preserve-3d animate-gyro-y">
                 <div className="absolute inset-0 rounded-full border-[3px] border-solid border-neuro-cyan/50 shadow-[0_0_15px_rgba(0,240,255,0.4)]"></div>
            </div>

             <div className="absolute -inset-4 preserve-3d animate-gyro-z opacity-60 pointer-events-none">
                 <div className="absolute inset-0 rounded-full border border-neuro-gold/40"></div>
                 <div className="absolute bottom-0 right-1/2 translate-x-1/2 w-2 h-2 bg-neuro-gold rounded-full shadow-[0_0_10px_#FFB800]"></div>
            </div>

            <div className="absolute inset-2 preserve-3d animate-gyro-diag-a opacity-80 pointer-events-none">
                 <div className="absolute inset-0 rounded-full border-2 border-neuro-pink/30"></div>
                 <div className="absolute inset-0 animate-spin-reverse">
                    <div className="absolute top-1/2 right-0 translate-x-1/2 w-2.5 h-2.5 bg-neuro-pink rounded-full shadow-[0_0_10px_#FF00E5]"></div>
                 </div>
            </div>

            <div className="absolute -inset-2 preserve-3d animate-gyro-diag-b opacity-40 pointer-events-none">
                 <div className="absolute inset-0 rounded-full border border-dotted border-white/50"></div>
                 <div className="absolute inset-0 animate-[spin_1.5s_linear_infinite]">
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/80 rounded-full blur-[1px]"></div>
                 </div>
            </div>
            
            <div className={`absolute inset-0 rounded-full border-4 border-white opacity-0 transition-all duration-300 ${isClicking ? 'scale-125 opacity-100' : 'scale-100 opacity-0'}`}></div>

          </div>
        </div>
      </div>

      {/* 4. Bottom Stats Dashboard */}
      <div className="absolute bottom-24 left-0 w-full z-20 pb-1 px-4">
        <div className="flex items-center gap-2 mb-2 pl-2">
             <div className="bg-neuro-violet/20 p-1 rounded">
                <Cpu size={14} className="text-neuro-violet" />
             </div>
             <span className="text-xs font-bold text-slate-300 tracking-wide uppercase font-sans">
               {t('miner.devicePower')}
             </span>
             <div className="h-[1px] flex-1 bg-gradient-to-r from-neuro-violet/30 to-transparent ml-2"></div>
        </div>

        <div className="glass-card rounded-xl p-1.5 bg-[#080808]/80 backdrop-blur-xl border border-white/5 relative mx-0">
           <div className="grid grid-cols-2 gap-1.5">
              
              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5 relative group overflow-hidden">
                 <div className="absolute right-0 top-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Zap size={30} />
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('miner.clickPower')}</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg font-mono font-bold text-white group-hover:text-neuro-cyan transition-colors shadow-none">
                            {formatHashValue(playerState.clickPower)}
                        </span>
                        <span className="text-[8px] text-neuro-cyan font-sans bg-neuro-cyan/10 px-1 rounded">/ TAP</span>
                    </div>
                 </div>
              </div>

              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5 relative group overflow-hidden">
                 <div className="absolute right-0 top-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Activity size={30} />
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('miner.devicePowerDesc')}</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg font-mono font-bold text-white group-hover:text-neuro-violet transition-colors shadow-none">
                            {formatHashrate(playerState.autoMineRate)}
                        </span>
                    </div>
                 </div>
              </div>

           </div>
        </div>
      </div>

    </div>
  );
};

export default Miner;
