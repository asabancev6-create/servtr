import React, { useState, useEffect, useRef } from 'react';
import { PlayerState, GlobalStats } from '../types';
import { Dices, Trophy, Coins, Sparkles, Zap, ArrowLeft, Disc, Target, Lock, Play, Gem, Hexagon, Triangle, Circle, Star, Skull, FlaskConical, Atom, Wallet } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { GameService } from '../services/mockBackend';

interface GamesProps {
  playerState: PlayerState;
  globalStats: GlobalStats;
  onUpdate: (newState: PlayerState) => void;
  onRefreshGlobal: () => void;
}

type Currency = 'NRC' | 'TON';

// ITEMS DEFINITION - Updated multipliers to match backend
const CYBER_ITEMS = [
    { id: 'shard', name: 'Broken Shard', mult: 0, icon: <Triangle className="rotate-180" size={32} />, color: 'text-slate-600', bg: 'bg-slate-700/10' },
    { id: 'chip', name: 'Data Chip', mult: 1.2, icon: <Hexagon size={32} />, color: 'text-neuro-cyan', bg: 'bg-neuro-cyan/10' },
    { id: 'skull', name: 'Cyber Skull', mult: 3.0, icon: <Skull size={32} />, color: 'text-red-500', bg: 'bg-red-500/10' },
    { id: 'potion', name: 'Neon Flask', mult: 10.0, icon: <FlaskConical size={32} />, color: 'text-neuro-pink', bg: 'bg-neuro-pink/10' },
    { id: 'core', name: 'Quantum Core', mult: 50.0, icon: <Atom size={32} />, color: 'text-neuro-gold', bg: 'bg-neuro-gold/10' },
];

const CURRENCY_CONFIG = {
    NRC: { color: 'text-neuro-cyan', bg: 'bg-neuro-cyan', border: 'border-neuro-cyan', shadow: 'shadow-[0_0_20px_rgba(0,240,255,0.4)]', betOptions: [10, 50, 100, 500] },
    TON: { color: 'text-[#0098EA]', bg: 'bg-[#0098EA]', border: 'border-[#0098EA]', shadow: 'shadow-[0_0_20px_rgba(0,152,234,0.4)]', betOptions: [0.1, 0.5, 1, 5] },
};

// --- SUB-COMPONENT: CYBER SPIN (ROULETTE) ---
const CyberSpin: React.FC<GamesProps & { onBack: () => void, currency: Currency }> = ({ playerState, globalStats, onUpdate, onRefreshGlobal, onBack, currency }) => {
    const { t } = useLanguage();
    const config = CURRENCY_CONFIG[currency];
    
    const [betAmount, setBetAmount] = useState<string>(config.betOptions[0].toString());
    const [isSpinning, setIsSpinning] = useState(false);
    const [displayItems, setDisplayItems] = useState([CYBER_ITEMS[1], CYBER_ITEMS[2], CYBER_ITEMS[0]]); // Left, Center, Right
    const [winResult, setWinResult] = useState<{item: any, payout: number} | null>(null);

    const handleSpin = () => {
        const bet = parseFloat(betAmount);
        if (isNaN(bet) || bet <= 0) {
            alert(t('games.invalid_bet'));
            return;
        }
        
        // Balance Check
        if (currency === 'NRC' && bet > playerState.balance) { alert(t('games.insufficient_funds')); return; }
        if (currency === 'TON' && bet > playerState.tonBalance) { alert(t('games.insufficient_funds')); return; }

        setIsSpinning(true);
        setWinResult(null);

        // --- ANIMATION PHASE ---
        let ticks = 0;
        const interval = setInterval(() => {
            setDisplayItems([
                CYBER_ITEMS[Math.floor(Math.random() * CYBER_ITEMS.length)],
                CYBER_ITEMS[Math.floor(Math.random() * CYBER_ITEMS.length)], 
                CYBER_ITEMS[Math.floor(Math.random() * CYBER_ITEMS.length)]
            ]);
            ticks++;
            
            if (ticks % 3 === 0 && window.Telegram?.WebApp?.HapticFeedback) {
                 window.Telegram.WebApp.HapticFeedback.selectionChanged();
            }

            if (ticks > 15) {
                clearInterval(interval);
                finishSpin(bet);
            }
        }, 80);
    };

    const finishSpin = (bet: number) => {
        const result = GameService.playCyberSpin(playerState, bet, currency);
        
        if (result.success && result.newState && result.resultItem) {
            onUpdate(result.newState);
            onRefreshGlobal();
            setIsSpinning(false);

            const wonItem = CYBER_ITEMS.find(i => i.id === result.resultItem) || CYBER_ITEMS[0];
            
            setDisplayItems([
                CYBER_ITEMS[Math.floor(Math.random() * CYBER_ITEMS.length)],
                wonItem,
                CYBER_ITEMS[Math.floor(Math.random() * CYBER_ITEMS.length)]
            ]);

            setWinResult({ item: wonItem, payout: result.payout || 0 });

            if (result.multiplier && result.multiplier >= 10) {
                 if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            } else if (result.multiplier && result.multiplier > 1) {
                 if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            } else {
                 if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }

        } else {
            setIsSpinning(false);
            alert((result as any).message || "Error");
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-slideUp">
             {/* Header */}
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex flex-col items-center">
                    <h3 className={`font-black uppercase tracking-widest text-lg flex items-center gap-2 ${config.color}`}>
                        <Disc className={config.color}/> Cyber Spin
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500">{currency} MODE</span>
                </div>
                <div className="w-8"></div>
            </div>

            {/* --- MAIN GAME AREA (CARDS) --- */}
            <div className="relative h-48 flex items-center justify-center perspective-500">
                {/* Background Glow */}
                <div className={`absolute inset-0 blur-[80px] opacity-30 ${config.bg}`}></div>

                <div className="flex items-center gap-4 relative z-10">
                    <div className={`glass-card w-24 h-32 rounded-xl flex items-center justify-center opacity-40 scale-90 blur-[1px] ${displayItems[0].bg}`}>
                         <div className={displayItems[0].color}>{displayItems[0].icon}</div>
                    </div>

                    <div className={`
                        w-32 h-40 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all duration-100
                        ${isSpinning ? 'scale-95 border-white/20 bg-black' : `scale-105 border-${displayItems[1].color.split('-')[1] || 'white'} ${displayItems[1].bg} shadow-[0_0_20px_currentColor]`}
                    `}>
                        <div className={`transition-transform duration-200 ${isSpinning ? 'scale-75 opacity-50' : 'scale-110'} ${displayItems[1].color}`}>
                            {displayItems[1].icon}
                        </div>
                        {!isSpinning && (
                            <div className="text-center animate-fadeIn">
                                <div className="text-xs font-bold text-white uppercase">{displayItems[1].name}</div>
                                <div className="text-sm font-mono font-black text-white">x{displayItems[1].mult}</div>
                            </div>
                        )}
                    </div>

                    <div className={`glass-card w-24 h-32 rounded-xl flex items-center justify-center opacity-40 scale-90 blur-[1px] ${displayItems[2].bg}`}>
                         <div className={displayItems[2].color}>{displayItems[2].icon}</div>
                    </div>
                </div>

                <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-neuro-gold drop-shadow-[0_0_10px_#FFB800] z-20">
                     <Triangle size={20} className="fill-neuro-gold rotate-180" />
                </div>
            </div>

            {/* Win Display */}
            <div className="h-12 flex items-center justify-center">
                {winResult && (
                    <div className="flex flex-col items-center animate-bounce">
                        {winResult.payout > 0 ? (
                            <>
                                <span className="text-xs font-bold text-slate-400 uppercase">You Won</span>
                                <span className={`text-2xl font-black font-mono ${winResult.payout >= parseFloat(betAmount) ? 'text-green-400' : 'text-slate-200'}`}>
                                    +{winResult.payout.toLocaleString()} {currency}
                                </span>
                            </>
                        ) : (
                            <span className="text-xl font-black font-mono text-slate-500 uppercase tracking-widest">
                                NO WIN
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Loot Table */}
            <div>
                 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 pl-1">You Can Win:</h4>
                 <div className="grid grid-cols-5 gap-2">
                     {CYBER_ITEMS.map(item => (
                         <div key={item.id} className={`glass-card p-2 rounded-lg flex flex-col items-center gap-1 border border-white/5 ${item.bg}`}>
                             <div className={`scale-75 ${item.color}`}>{item.icon}</div>
                             <span className="text-[10px] font-mono font-bold text-white">x{item.mult}</span>
                         </div>
                     ))}
                 </div>
            </div>

            {/* Controls */}
            <div className="glass-card p-4 rounded-xl border border-white/10 bg-[#080808]">
                <div className="flex justify-between items-center mb-4">
                     <span className="text-xs font-bold text-slate-400 uppercase">{t('games.bet_amount')}</span>
                     <div className={`flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border ${config.border} border-opacity-30`}>
                        <input 
                            type="number" 
                            value={betAmount}
                            onChange={(e) => setBetAmount(e.target.value)}
                            className="w-20 bg-transparent text-right text-white font-mono font-bold outline-none"
                            step={currency === 'TON' ? "0.1" : "1"}
                        />
                        <span className={`text-xs font-bold ${config.color}`}>{currency}</span>
                     </div>
                </div>
                
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 custom-scrollbar">
                     {config.betOptions.map(amt => (
                         <button 
                            key={amt}
                            onClick={() => setBetAmount(amt.toString())}
                            className="flex-shrink-0 px-4 py-2 bg-white/5 rounded-lg text-xs font-bold text-slate-300 border border-white/5 hover:bg-white/10 hover:text-white transition-colors"
                         >
                             {amt}
                         </button>
                     ))}
                </div>

                <button 
                    onClick={handleSpin}
                    disabled={isSpinning}
                    className={`
                        w-full py-4 rounded-xl font-black text-lg tracking-widest uppercase transition-all shadow-lg
                        ${isSpinning 
                            ? `${config.bg} opacity-50 cursor-not-allowed` 
                            : `${config.bg} hover:brightness-110 hover:scale-[1.02] text-black ${config.shadow}`}
                    `}
                >
                    {isSpinning ? t('games.spinning') : 'SPIN'}
                </button>
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: QUANTUM SLOTS ---
const QuantumSlots: React.FC<GamesProps & { onBack: () => void, currency: Currency }> = ({ playerState, globalStats, onUpdate, onRefreshGlobal, onBack, currency }) => {
    const { t } = useLanguage();
    const config = CURRENCY_CONFIG[currency];

    const [betAmount, setBetAmount] = useState<string>(config.betOptions[0].toString());
    const [isSpinning, setIsSpinning] = useState(false);
    const [reels, setReels] = useState<string[]>(['7', '7', '7']);
    const [winMessage, setWinMessage] = useState<string | null>(null);

    const handleSpin = () => {
        const bet = parseFloat(betAmount);
        if (isNaN(bet) || bet <= 0) { alert(t('games.invalid_bet')); return; }
        
        // Balance Check
        if (currency === 'NRC' && bet > playerState.balance) { alert(t('games.insufficient_funds')); return; }
        if (currency === 'TON' && bet > playerState.tonBalance) { alert(t('games.insufficient_funds')); return; }
  
        setIsSpinning(true);
        setWinMessage(null);
  
        let spins = 0;
        const interval = setInterval(() => {
            setReels([
               ['7','@','#','%','&'][Math.floor(Math.random()*5)],
               ['7','@','#','%','&'][Math.floor(Math.random()*5)],
               ['7','@','#','%','&'][Math.floor(Math.random()*5)]
            ]);
            spins++;
            if(window.Telegram?.WebApp?.HapticFeedback) {
               window.Telegram.WebApp.HapticFeedback.selectionChanged();
            }
            if (spins > 10) {
                clearInterval(interval);
                finishSpin(bet);
            }
        }, 100);
    };
  
    const finishSpin = (bet: number) => {
        const result = GameService.playQuantumSlots(playerState, bet, currency);
        
        if (result.success && result.newState && result.result) {
            setReels(result.result);
            onUpdate(result.newState);
            onRefreshGlobal();
            setIsSpinning(false);
  
            if (result.isJackpot) {
                setWinMessage(`${t('games.big_win')} +${result.payout} ${currency}`);
                if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            } else if ((result.payout || 0) > 0) {
                setWinMessage(`${t('games.win')} +${result.payout} ${currency}`);
                if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            } else {
                setWinMessage(null); // Clear win message on loss
                if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
        } else {
            setIsSpinning(false);
            alert((result as any).message || "Error");
        }
    };

    return (
        <div className={`glass-card rounded-3xl p-6 bg-[#0a0a0a] border ${config.border} border-opacity-30 relative shadow-glow animate-slideUp`}>
            
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex flex-col items-center">
                    <h3 className={`font-black uppercase tracking-widest text-lg ${config.color}`}>Quantum Slots</h3>
                    <span className="text-[10px] text-slate-400 font-bold">{currency} EDITION</span>
                </div>
                <div className="w-8"></div>
            </div>

            {/* Reels */}
            <div className={`flex justify-center gap-2 mb-8 bg-black/50 p-4 rounded-xl border ${config.border} border-opacity-20 shadow-inner`}>
                {reels.map((symbol, i) => (
                    <div key={i} className="w-20 h-24 bg-gradient-to-b from-[#1a1a1a] to-[#050505] border border-white/10 rounded-lg flex items-center justify-center text-4xl font-bold relative overflow-hidden shadow-lg">
                        <span className={`
                            ${symbol === '7' ? 'text-neuro-gold drop-shadow-[0_0_10px_#FFB800]' : ''}
                            ${symbol === '@' ? 'text-neuro-cyan drop-shadow-[0_0_8px_#00F0FF]' : ''}
                            ${symbol === '#' ? 'text-neuro-pink drop-shadow-[0_0_8px_#FF00E5]' : ''}
                            ${['%','&'].includes(symbol) ? 'text-slate-400' : ''}
                        `}>
                            {symbol === '@' ? <Zap size={32}/> : symbol === '#' ? <Gem size={32}/> : symbol}
                        </span>
                    </div>
                ))}
            </div>

            {/* Win Message */}
            <div className="h-8 text-center mb-4">
                {winMessage && (
                    <div className="text-neuro-green font-bold text-lg animate-bounce drop-shadow-[0_0_5px_rgba(0,255,0,0.8)]">
                        {winMessage}
                    </div>
                )}
                {!winMessage && !isSpinning && (
                     <div className="text-slate-500 font-bold text-xs uppercase tracking-widest">
                        Good Luck
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center bg-white/5 p-2 rounded-xl border border-white/5">
                    <span className="text-xs font-bold text-slate-400 uppercase ml-2">{t('games.bet_amount')}</span>
                    <div className="flex items-center gap-2">
                        <input 
                            type="number" 
                            value={betAmount}
                            onChange={(e) => setBetAmount(e.target.value)}
                            className="w-20 bg-black/50 border border-white/10 rounded-lg py-1 px-2 text-right text-white font-mono font-bold outline-none"
                            step={currency === 'TON' ? "0.1" : "1"}
                        />
                        <span className={`text-xs font-bold ${config.color} mr-2`}>{currency}</span>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                     {config.betOptions.map(amt => (
                         <button 
                            key={amt}
                            onClick={() => setBetAmount(amt.toString())}
                            className="bg-white/5 hover:bg-white/10 rounded-lg py-2 text-[10px] font-bold text-slate-400 border border-white/5 transition-colors"
                         >
                             {amt}
                         </button>
                     ))}
                </div>

                <button 
                    onClick={handleSpin}
                    disabled={isSpinning}
                    className={`
                        w-full py-4 rounded-xl font-black text-lg tracking-widest uppercase transition-all shadow-lg
                        ${isSpinning 
                            ? `${config.bg} opacity-50 cursor-not-allowed` 
                            : `${config.bg} hover:brightness-110 hover:scale-[1.02] text-black`}
                    `}
                >
                    {isSpinning ? t('games.spinning') : t('games.spin')}
                </button>
            </div>
        </div>
    );
}

// --- MAIN HUB COMPONENT ---
const Games: React.FC<GamesProps> = (props) => {
  const { t } = useLanguage();
  const [activeGame, setActiveGame] = useState<'slots' | 'roulette' | null>(null);
  const [currency, setCurrency] = useState<Currency>('NRC');
  const [jackpotAmount, setJackpotAmount] = useState(0);

  // Sync Jackpot Amount based on selected Currency
  useEffect(() => {
     let pool = 0;
     if (currency === 'NRC') pool = props.globalStats.rewardPoolNrc;
     else pool = props.globalStats.rewardPoolTon;

     // 10% of Pool
     setJackpotAmount(Math.floor(pool * 0.10));
  }, [props.globalStats, currency]);

  // Visual Config for active currency
  const config = CURRENCY_CONFIG[currency];

  // RENDER: SLOTS
  if (activeGame === 'slots') {
      return (
          <div className="flex flex-col gap-6 animate-fadeIn p-4 pb-32">
              <QuantumSlots {...props} onBack={() => setActiveGame(null)} currency={currency} />
          </div>
      );
  }

  // RENDER: ROULETTE (Cyber Spin)
  if (activeGame === 'roulette') {
      return (
          <div className="flex flex-col gap-6 animate-fadeIn p-4 pb-32">
              <CyberSpin {...props} onBack={() => setActiveGame(null)} currency={currency} />
          </div>
      );
  }

  // RENDER: LOBBY
  return (
    <div className="flex flex-col gap-6 animate-fadeIn p-4 pb-32">
        <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-sans font-bold text-white flex items-center gap-2">
                <Dices className="text-neuro-pink" /> 
                <span className="gradient-text">{t('games.title')}</span>
            </h2>
            <p className="text-slate-400 text-sm">{t('games.hub_subtitle')}</p>
        </div>

        {/* CURRENCY SWITCHER */}
        <div className="flex bg-[#0a0a0a] rounded-xl p-1 border border-white/10 gap-1">
            {(['NRC', 'TON'] as Currency[]).map((curr) => {
                const isActive = currency === curr;
                const cConf = CURRENCY_CONFIG[curr];
                
                return (
                    <button
                        key={curr}
                        onClick={() => setCurrency(curr)}
                        className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 relative overflow-hidden
                            ${isActive ? `${cConf.bg} text-black shadow-lg scale-[1.02]` : ''}
                            ${!isActive ? 'text-slate-500 hover:text-white hover:bg-white/5' : ''}
                        `}
                    >
                        {/* Icons */}
                        {curr === 'TON' && <Wallet size={12}/>}
                        {curr === 'NRC' && <Zap size={12} fill="currentColor"/>}
                        
                        {curr}
                    </button>
                )
            })}
        </div>

        {/* --- JACKPOT CARD (Dynamic) --- */}
        <div className={`glass-card rounded-2xl p-6 border ${config.border} border-opacity-50 bg-opacity-10 relative overflow-hidden text-center shadow-[0_0_30px_rgba(0,0,0,0.5)]`}>
            {/* Animated Background */}
            <div className={`absolute top-0 left-0 w-full h-1 ${config.bg} shadow-[0_0_10px_currentColor]`}></div>
            <div className={`absolute -top-10 -right-10 w-32 h-32 ${config.bg} opacity-20 blur-[40px] rounded-full animate-pulse-slow`}></div>
            
            <div className="relative z-10">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <Trophy size={18} className={config.color} />
                    <span className={`text-xs font-bold uppercase tracking-[0.2em] ${config.color}`}>{t('games.jackpot')}</span>
                    <Trophy size={18} className={config.color} />
                </div>
                
                <div className="text-4xl font-black font-mono text-white drop-shadow-md mb-2">
                    {jackpotAmount.toLocaleString()} <span className={`text-lg ${config.color}`}>{currency}</span>
                </div>
                <div className="flex items-center justify-center gap-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                     <span className="flex items-center gap-1"><Coins size={10} className={config.color}/> {t('games.jackpot_desc')}</span>
                </div>
            </div>
        </div>

        {/* --- GAMES GRID --- */}
        <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 px-1">{t('games.available_games')}</h3>
            
            <div className="grid grid-cols-1 gap-4">
                
                {/* GAME 1: QUANTUM SLOTS */}
                <button 
                    onClick={() => setActiveGame('slots')}
                    className={`group relative glass-card p-0 rounded-2xl overflow-hidden text-left transition-all hover:border-opacity-100 hover:scale-[1.01] active:scale-[0.99] border border-white/5 hover:${config.border}`}
                >
                    <div className={`absolute inset-0 bg-gradient-to-r ${config.bg} to-transparent opacity-0 group-hover:opacity-10 transition-opacity`}></div>
                    
                    <div className="flex items-center gap-4 p-4">
                        <div className={`w-16 h-16 rounded-xl bg-opacity-20 border border-opacity-50 flex items-center justify-center transition-shadow ${config.bg} ${config.border} shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
                            <Dices size={32} className={config.color} />
                        </div>
                        <div className="flex-1">
                            <h4 className={`text-lg font-bold text-white mb-1 group-hover:${config.color} transition-colors`}>Quantum Slots</h4>
                            <p className="text-xs text-slate-400 mb-2">High variance, instant wins.</p>
                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold ${config.bg} text-black px-2 py-0.5 rounded`}>HOT</span>
                            </div>
                        </div>
                        <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:${config.bg} group-hover:text-black transition-colors`}>
                            <Play size={14} className="ml-0.5" />
                        </div>
                    </div>
                </button>

                {/* GAME 2: CYBER SPIN */}
                <button 
                    onClick={() => setActiveGame('roulette')}
                    className={`group relative glass-card p-0 rounded-2xl overflow-hidden text-left transition-all hover:border-opacity-100 hover:scale-[1.01] active:scale-[0.99] border border-white/5 hover:${config.border}`}
                >
                     <div className={`absolute inset-0 bg-gradient-to-r ${config.bg} to-transparent opacity-0 group-hover:opacity-10 transition-opacity`}></div>
                    
                    <div className="flex items-center gap-4 p-4">
                         <div className={`w-16 h-16 rounded-xl bg-opacity-20 border border-opacity-50 flex items-center justify-center transition-shadow ${config.bg} ${config.border} shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
                            <Disc size={32} className={config.color} />
                         </div>
                         <div className="flex-1">
                            <h4 className={`text-lg font-bold text-white mb-1 group-hover:${config.color} transition-colors`}>Cyber Spin</h4>
                            <p className="text-xs text-slate-400 mb-2">Spin the wheel for artifacts.</p>
                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold ${config.bg} text-black px-2 py-0.5 rounded`}>NEW</span>
                            </div>
                         </div>
                         <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:${config.bg} group-hover:text-black transition-colors`}>
                            <Play size={14} className="ml-0.5" />
                        </div>
                    </div>
                </button>

            </div>
        </div>
    </div>
  );
};

export default Games;