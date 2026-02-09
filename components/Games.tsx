
import React, { useState, useEffect, useRef } from 'react';
import { PlayerState, GlobalStats } from '../types';
import { Dices, Trophy, Coins, Sparkles, Zap, ArrowLeft, Disc, Target, Lock, Play, Gem, Hexagon, Triangle, Circle, Star, Skull, FlaskConical, Atom, Wallet, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Rocket, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { GameService } from '../services/mockBackend';

interface GamesProps {
  playerState: PlayerState;
  globalStats: GlobalStats;
  onUpdate: (newState: PlayerState) => void;
  onRefreshGlobal: () => void;
}

type Currency = 'NRC' | 'TON' | 'STARS';

// ITEMS DEFINITION
const CYBER_ITEMS = [
    { id: 'shard', name: 'Broken Shard', mult: 0.5, icon: <Triangle className="rotate-180" size={32} />, color: 'text-slate-500', bg: 'bg-slate-700/10' },
    { id: 'chip', name: 'Data Chip', mult: 1.1, icon: <Hexagon size={32} />, color: 'text-neuro-cyan', bg: 'bg-neuro-cyan/10' },
    { id: 'skull', name: 'Cyber Skull', mult: 2.0, icon: <Skull size={32} />, color: 'text-red-500', bg: 'bg-red-500/10' },
    { id: 'potion', name: 'Neon Flask', mult: 5.0, icon: <FlaskConical size={32} />, color: 'text-neuro-pink', bg: 'bg-neuro-pink/10' },
    { id: 'core', name: 'Quantum Core', mult: 50.0, icon: <Atom size={32} />, color: 'text-neuro-gold', bg: 'bg-neuro-gold/10' },
];

const CURRENCY_CONFIG = {
    NRC: { color: 'text-neuro-cyan', bg: 'bg-neuro-cyan', border: 'border-neuro-cyan', shadow: 'shadow-[0_0_20px_rgba(0,240,255,0.4)]', betOptions: [10, 50, 100, 500] },
    TON: { color: 'text-[#0098EA]', bg: 'bg-[#0098EA]', border: 'border-[#0098EA]', shadow: 'shadow-[0_0_20px_rgba(0,152,234,0.4)]', betOptions: [0.1, 0.5, 1, 5] },
    STARS: { color: 'text-[#FFB800]', bg: 'bg-[#FFB800]', border: 'border-[#FFB800]', shadow: 'shadow-[0_0_20px_rgba(255,184,0,0.4)]', betOptions: [50, 100, 500, 1000] }
};

// --- SUB-COMPONENT: NEON CRASH (AVIATOR) ---
const NeuroCrash: React.FC<GamesProps & { onBack: () => void, currency: Currency }> = ({ playerState, globalStats, onUpdate, onRefreshGlobal, onBack, currency }) => {
    const { t } = useLanguage();
    const config = CURRENCY_CONFIG[currency];
    
    const [betAmount, setBetAmount] = useState<string>(config.betOptions[0].toString());
    const [multiplier, setMultiplier] = useState(1.00);
    
    // State separation:
    // isGameRunning: The plane is flying (global state)
    // userInGame: The user has a bet active in the current flight
    const [isGameRunning, setIsGameRunning] = useState(false);
    const [userInGame, setUserInGame] = useState(false);
    
    const [crashed, setCrashed] = useState(false);
    const [cashedOutAt, setCashedOutAt] = useState<number | null>(null); // Multiplier where user exited
    const [winAmount, setWinAmount] = useState(0);
    
    // Crash History
    const [history, setHistory] = useState<number[]>([1.45, 2.10, 1.05, 5.42, 1.88, 12.50]); // Initial dummy history

    const crashPointRef = useRef(0);
    const animationRef = useRef<number>();
    const startTimeRef = useRef(0);

    const startGame = async () => {
        const bet = parseFloat(betAmount);
        if (isNaN(bet) || bet <= 0) { alert(t('games.invalid_bet')); return; }
        
        // Check funds BEFORE starting local simulation
        if (currency === 'NRC' && playerState.balance < bet) { alert(t('games.insufficient_funds')); return; }
        if (currency === 'TON' && playerState.tonBalance < bet) { alert(t('games.insufficient_funds')); return; }
        if (currency === 'STARS' && playerState.starsBalance < bet) { alert(t('games.insufficient_funds')); return; }
        
        const res = await GameService.startCrashGame(playerState, bet, currency);
        if (res.success && res.newState && res.crashPoint) {
            onUpdate(res.newState); // Deduct bet immediately
            onRefreshGlobal();
            
            crashPointRef.current = res.crashPoint;
            
            // Reset Round State
            setIsGameRunning(true);
            setUserInGame(true);
            setCrashed(false);
            setCashedOutAt(null);
            setWinAmount(0);
            setMultiplier(1.00);
            
            startTimeRef.current = Date.now();
            animate();
        } else {
            alert(res.message);
        }
    };

    const animate = () => {
        const now = Date.now();
        const elapsed = now - startTimeRef.current;
        
        // Exponential growth formula: 1.06 ^ seconds
        const rawMult = Math.pow(1.06, elapsed / 1000); 
        
        // Check CRASH condition
        if (rawMult >= crashPointRef.current) {
            setMultiplier(crashPointRef.current);
            setCrashed(true);
            setIsGameRunning(false); // Flight over
            setUserInGame(false); // Bet over
            setHistory(prev => [crashPointRef.current, ...prev].slice(0, 10)); // Add to history
            if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
        } else {
            setMultiplier(rawMult);
            animationRef.current = requestAnimationFrame(animate);
        }
    };

    const cashOut = async () => {
        if (!userInGame || crashed) return;
        
        // 1. Mark user as exited, but DO NOT stop animation
        setUserInGame(false);
        setCashedOutAt(multiplier);
        
        const bet = parseFloat(betAmount);
        const win = bet * multiplier;
        setWinAmount(win);
        
        // 2. Secure funds backend
        const res = await GameService.cashOutCrashGame(playerState, bet, multiplier, currency);
        if (res.success && res.newState) {
            onUpdate(res.newState);
            onRefreshGlobal();
            if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
    };

    // Clean up on unmount only
    useEffect(() => {
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, []);

    return (
        <div className="flex flex-col gap-6 animate-slideUp h-full">
             <div className="flex items-center justify-between">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex flex-col items-center">
                    <h3 className={`font-black uppercase tracking-widest text-lg flex items-center gap-2 ${config.color}`}>
                        <Rocket className={config.color}/> {t('games.crash_title')}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500">{currency} MODE</span>
                </div>
                <div className="w-8"></div>
            </div>

            {/* Game Screen */}
            <div className="flex-1 min-h-[250px] glass-card rounded-2xl relative overflow-hidden bg-[#080808] flex flex-col justify-center items-center border border-white/10">
                {/* Grid Background */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                
                {/* Central Display */}
                <div className="relative z-10 text-center">
                    {crashed ? (
                        <div className="flex flex-col items-center animate-bounce">
                            <span className="text-5xl font-black text-red-500 font-mono tracking-tighter shadow-red-glow">{multiplier.toFixed(2)}x</span>
                            <span className="text-xs font-bold text-red-500 uppercase tracking-widest mt-2">{t('games.crashed')}</span>
                            {/* If user cashed out before crash, show their win too */}
                            {cashedOutAt && (
                                <div className="mt-2 bg-green-500/10 border border-green-500/30 px-3 py-1 rounded-lg">
                                    <span className="text-[10px] text-green-400 font-bold uppercase">You took: {cashedOutAt.toFixed(2)}x</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            {/* Main Counter - Always runs until crash */}
                            <span className={`text-6xl font-black font-mono tracking-tighter transition-colors ${isGameRunning ? 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'text-slate-500'}`}>
                                {multiplier.toFixed(2)}x
                            </span>
                            
                            {/* User Status Badge */}
                            {cashedOutAt && isGameRunning && (
                                <div className="mt-4 flex flex-col items-center animate-scaleIn bg-green-500/20 border border-green-500/50 px-4 py-2 rounded-xl backdrop-blur-md">
                                    <span className="text-xs font-bold text-green-400 uppercase tracking-widest">{t('games.flight_win')}</span>
                                    <span className="text-xl font-black text-white mt-0.5">+{winAmount.toFixed(2)} {currency}</span>
                                    <span className="text-[10px] text-green-300">@ {cashedOutAt.toFixed(2)}x</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Rocket Animation */}
                {isGameRunning && (
                    <div 
                        className="absolute bottom-10 left-10 transition-transform duration-100 ease-linear will-change-transform" 
                        style={{ transform: `translate(${Math.min(220, (multiplier-1)*60)}px, -${Math.min(180, (multiplier-1)*50)}px)` }}
                    >
                        <Rocket size={48} className={`${config.color} rotate-45 drop-shadow-[0_0_20px_currentColor]`} />
                        <div className={`absolute top-full left-0 w-1.5 h-24 bg-gradient-to-t from-transparent to-${config.color.split('-')[1]} opacity-60 blur-sm transform -rotate-45 origin-top`}></div>
                        {/* Engine Particle */}
                        <div className="absolute top-[35px] left-[-10px] w-3 h-3 bg-white rounded-full animate-ping"></div>
                    </div>
                )}
            </div>

            {/* History Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 px-1 custom-scrollbar mask-gradient">
                {history.map((h, i) => (
                    <div 
                        key={i} 
                        className={`
                            flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-mono font-bold border
                            ${h >= 10 
                                ? 'bg-neuro-gold text-black border-neuro-gold' 
                                : h >= 2 
                                    ? 'bg-neuro-pink/20 text-neuro-pink border-neuro-pink/30' 
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                            }
                        `}
                    >
                        {h.toFixed(2)}x
                    </div>
                ))}
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
                            disabled={isGameRunning} 
                            className="w-20 bg-transparent text-right text-white font-mono font-bold outline-none"
                            step={currency === 'TON' ? "0.1" : "1"}
                        />
                        <span className={`text-xs font-bold ${config.color}`}>{currency}</span>
                     </div>
                </div>

                {/* Button Logic: 
                    If User In Game -> SHOW CASH OUT
                    If User Cashed Out but Game Running -> SHOW "WAITING FOR CRASH" (Disabled)
                    If Game Not Running -> SHOW LAUNCH
                */}
                {userInGame ? (
                    <button 
                        onClick={cashOut}
                        className={`w-full py-4 rounded-xl font-black text-lg tracking-widest uppercase transition-all shadow-lg bg-green-500 hover:bg-green-400 text-black shadow-[0_0_20px_rgba(0,255,65,0.4)] active:scale-95`}
                    >
                        {t('games.cash_out')}
                    </button>
                ) : isGameRunning ? (
                    <button 
                        disabled 
                        className="w-full py-4 rounded-xl font-bold text-sm tracking-widest uppercase bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed flex flex-col items-center leading-tight"
                    >
                        <span>ROUND IN PROGRESS</span>
                        <span className="text-[9px]">WAIT FOR CRASH</span>
                    </button>
                ) : (
                    <button 
                        onClick={startGame}
                        className={`
                            w-full py-4 rounded-xl font-black text-lg tracking-widest uppercase transition-all shadow-lg
                            ${config.bg} hover:brightness-110 hover:scale-[1.02] active:scale-95 text-black ${config.shadow}
                        `}
                    >
                        {t('games.start_flight')}
                    </button>
                )}
            </div>
        </div>
    );
}

// --- SUB-COMPONENT: NEON DICE (Existing) ---
const NeonDice: React.FC<GamesProps & { onBack: () => void, currency: Currency }> = ({ playerState, globalStats, onUpdate, onRefreshGlobal, onBack, currency }) => {
    const { t } = useLanguage();
    const config = CURRENCY_CONFIG[currency];

    const [betAmount, setBetAmount] = useState<string>(config.betOptions[0].toString());
    const [isRolling, setIsRolling] = useState(false);
    const [dice, setDice] = useState<number[]>([1, 1]);
    const [resultMessage, setResultMessage] = useState<string | null>(null);

    const diceIcons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

    const handleRoll = (prediction: 'low' | 'seven' | 'high') => {
        const bet = parseFloat(betAmount);
        if (isNaN(bet) || bet <= 0) { alert(t('games.invalid_bet')); return; }
        
        // Balance Check
        if (currency === 'NRC' && bet > playerState.balance) { alert(t('games.insufficient_funds')); return; }
        if (currency === 'TON' && bet > playerState.tonBalance) { alert(t('games.insufficient_funds')); return; }
        if (currency === 'STARS' && bet > playerState.starsBalance) { alert(t('games.insufficient_funds')); return; }

        setIsRolling(true);
        setResultMessage(null);

        // Animation Loop
        let rolls = 0;
        const interval = setInterval(() => {
            setDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]);
            rolls++;
            if (rolls > 10) {
                clearInterval(interval);
                finishRoll(bet, prediction);
            }
        }, 80);
    };

    const finishRoll = async (bet: number, prediction: 'low' | 'seven' | 'high') => {
        const result = await GameService.playNeonDice(playerState, bet, currency, prediction);

        if (result.success && result.newState && result.dice) {
            setDice(result.dice);
            onUpdate(result.newState);
            onRefreshGlobal();
            setIsRolling(false);

            if ((result.payout || 0) > 0) {
                setResultMessage(`${t('games.win')} +${result.payout} ${currency}`);
                if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            } else {
                setResultMessage("LOSS");
                if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
            }
        } else {
            setIsRolling(false);
            alert(result.message);
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
                        <Dices className={config.color}/> {t('games.dice_title')}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500">{currency} MODE</span>
                </div>
                <div className="w-8"></div>
            </div>

            {/* DICE DISPLAY */}
            <div className="flex justify-center gap-6 py-8 relative">
                 {/* Background Effect */}
                 <div className={`absolute inset-0 blur-[60px] opacity-20 ${config.bg}`}></div>

                 {dice.map((val, idx) => {
                     const Icon = diceIcons[val - 1];
                     return (
                         <div key={idx} className={`w-24 h-24 glass-card rounded-2xl flex items-center justify-center border-2 ${config.border} shadow-[0_0_20px_rgba(0,0,0,0.5)] transform transition-transform ${isRolling ? 'rotate-12 scale-110' : ''}`}>
                             <Icon size={48} className={`text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]`} />
                         </div>
                     )
                 })}
            </div>

            {/* Result Message */}
            <div className="h-8 text-center -mt-2">
                 <div className={`font-mono font-black text-xl uppercase ${resultMessage === 'LOSS' ? 'text-red-500' : 'text-green-400'}`}>
                     {resultMessage}
                 </div>
                 {!resultMessage && !isRolling && <div className="text-slate-500 text-xs font-bold">{dice[0] + dice[1]} TOTAL</div>}
            </div>

            {/* PREDICTION BUTTONS */}
            <div className="grid grid-cols-3 gap-3">
                 <button 
                    disabled={isRolling}
                    onClick={() => handleRoll('low')}
                    className="flex flex-col items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 active:scale-95 transition-all"
                 >
                     <span className="text-xs font-bold text-slate-400">{t('games.dice_low')}</span>
                     <span className={`text-lg font-black ${config.color}`}>x1.7</span>
                 </button>

                 <button 
                    disabled={isRolling}
                    onClick={() => handleRoll('seven')}
                    className={`flex flex-col items-center gap-1 border rounded-xl p-4 active:scale-95 transition-all ${config.border} bg-opacity-10 ${config.bg}`}
                 >
                     <span className="text-xs font-bold text-white">{t('games.dice_seven')}</span>
                     <span className="text-lg font-black text-white drop-shadow-md">x4.2</span>
                 </button>

                 <button 
                    disabled={isRolling}
                    onClick={() => handleRoll('high')}
                    className="flex flex-col items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 active:scale-95 transition-all"
                 >
                     <span className="text-xs font-bold text-slate-400">{t('games.dice_high')}</span>
                     <span className={`text-lg font-black ${config.color}`}>x1.7</span>
                 </button>
            </div>

            {/* BET CONTROLS */}
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
                
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
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
            </div>

        </div>
    );
};

// --- SUB-COMPONENT: CYBER SPIN (ROULETTE) (Existing) ---
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
        if (currency === 'STARS' && bet > playerState.starsBalance) { alert(t('games.insufficient_funds')); return; }

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

    const finishSpin = async (bet: number) => {
        const result = await GameService.playCyberSpin(playerState, bet, currency);
        
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
            alert(result.message || "Error");
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
                        {winResult.payout > parseFloat(betAmount) ? (
                            <>
                                <span className="text-xs font-bold text-slate-400 uppercase">You Won</span>
                                <span className="text-2xl font-black font-mono text-green-400">
                                    +{winResult.payout.toLocaleString()} {currency}
                                </span>
                            </>
                        ) : winResult.payout > 0 ? (
                            <>
                                <span className="text-xs font-bold text-slate-500 uppercase">RETENTION</span>
                                <span className="text-xl font-black font-mono text-white/80">
                                    {winResult.payout.toLocaleString()} {currency}
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

// --- SUB-COMPONENT: QUANTUM SLOTS (Existing) ---
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
        if (currency === 'STARS' && bet > playerState.starsBalance) { alert(t('games.insufficient_funds')); return; }
  
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
  
    const finishSpin = async (bet: number) => {
        const result = await GameService.playQuantumSlots(playerState, bet, currency);
        
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
            alert(result.message || "Error");
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
  const [activeGame, setActiveGame] = useState<'slots' | 'roulette' | 'dice' | 'crash' | null>(null);
  const [currency, setCurrency] = useState<Currency>('NRC');
  const [jackpotAmount, setJackpotAmount] = useState(0);

  // Sync Jackpot Amount based on selected Currency
  useEffect(() => {
     let pool = 0;
     if (currency === 'NRC') pool = props.globalStats.rewardPoolNrc;
     else if (currency === 'TON') pool = props.globalStats.rewardPoolTon;
     else pool = props.globalStats.rewardPoolStars;

     // 10% of Pool
     setJackpotAmount(Math.floor(pool * 0.10));
  }, [props.globalStats, currency]);

  // Visual Config for active currency
  const config = CURRENCY_CONFIG[currency];

  // RENDER: GAMES SWITCHER
  if (activeGame === 'slots') return <div className="flex flex-col gap-6 animate-fadeIn p-4 pb-32"><QuantumSlots {...props} onBack={() => setActiveGame(null)} currency={currency} /></div>;
  if (activeGame === 'roulette') return <div className="flex flex-col gap-6 animate-fadeIn p-4 pb-32"><CyberSpin {...props} onBack={() => setActiveGame(null)} currency={currency} /></div>;
  if (activeGame === 'dice') return <div className="flex flex-col gap-6 animate-fadeIn p-4 pb-32"><NeonDice {...props} onBack={() => setActiveGame(null)} currency={currency} /></div>;
  if (activeGame === 'crash') return <div className="flex flex-col gap-6 animate-fadeIn p-4 pb-32"><NeuroCrash {...props} onBack={() => setActiveGame(null)} currency={currency} /></div>;

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
            {(['NRC', 'TON', 'STARS'] as Currency[]).map((curr) => {
                const isActive = currency === curr;
                const cConf = CURRENCY_CONFIG[curr];
                const isLocked = curr !== 'NRC'; // Only NRC is currently active
                
                return (
                    <button
                        key={curr}
                        disabled={isLocked}
                        onClick={() => !isLocked && setCurrency(curr)}
                        className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 relative overflow-hidden
                            ${isActive ? `${cConf.bg} text-black shadow-lg scale-[1.02]` : ''}
                            ${isLocked ? 'bg-white/5 opacity-50 cursor-not-allowed border border-white/5 text-slate-600' : 'text-slate-500 hover:text-white hover:bg-white/5'}
                        `}
                    >
                        {/* Icons */}
                        {curr === 'TON' && <Wallet size={12}/>}
                        {curr === 'STARS' && <Star size={12} fill="currentColor"/>}
                        {curr === 'NRC' && <Zap size={12} fill="currentColor"/>}
                        
                        {curr}

                        {/* Lock / Soon Badge */}
                        {isLocked && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                                <span className="text-[9px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-lg transform rotate-[-5deg] border border-white/20">
                                    <Lock size={8} /> SOON
                                </span>
                            </div>
                        )}
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
                
                {/* GAME 2: NEURO CRASH */}
                <button 
                    onClick={() => setActiveGame('crash')}
                    className={`group relative glass-card p-0 rounded-2xl overflow-hidden text-left transition-all hover:border-opacity-100 hover:scale-[1.01] active:scale-[0.99] border border-white/5 hover:${config.border}`}
                >
                    <div className={`absolute inset-0 bg-gradient-to-r ${config.bg} to-transparent opacity-0 group-hover:opacity-10 transition-opacity`}></div>
                    
                    <div className="flex items-center gap-4 p-4">
                        <div className={`w-16 h-16 rounded-xl bg-opacity-20 border border-opacity-50 flex items-center justify-center transition-shadow ${config.bg} ${config.border} shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
                            <Rocket size={32} className={`${config.color} -rotate-45`} />
                        </div>
                        <div className="flex-1">
                            <h4 className={`text-lg font-bold text-white mb-1 group-hover:${config.color} transition-colors`}>{t('games.crash_title')}</h4>
                            <p className="text-xs text-slate-400 mb-2">{t('games.crash_desc')}</p>
                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold ${config.bg} text-black px-2 py-0.5 rounded`}>HIGH RISK</span>
                            </div>
                        </div>
                        <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:${config.bg} group-hover:text-black transition-colors`}>
                            <Play size={14} className="ml-0.5" />
                        </div>
                    </div>
                </button>

                {/* GAME 3: QUANTUM SLOTS */}
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
                                <span className={`text-[9px] font-bold text-slate-300 border border-white/20 px-2 py-0.5 rounded`}>CLASSIC</span>
                            </div>
                        </div>
                        <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:${config.bg} group-hover:text-black transition-colors`}>
                            <Play size={14} className="ml-0.5" />
                        </div>
                    </div>
                </button>

                {/* GAME 4: CYBER SPIN */}
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
                                <span className={`text-[9px] font-bold text-slate-300 border border-white/20 px-2 py-0.5 rounded`}>LOOT</span>
                            </div>
                         </div>
                         <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:${config.bg} group-hover:text-black transition-colors`}>
                            <Play size={14} className="ml-0.5" />
                        </div>
                    </div>
                </button>

                {/* GAME 5: NEON DICE */}
                <button 
                    onClick={() => setActiveGame('dice')}
                    className={`group relative glass-card p-0 rounded-2xl overflow-hidden text-left transition-all hover:border-opacity-100 hover:scale-[1.01] active:scale-[0.99] border border-white/5 hover:${config.border}`}
                >
                     <div className={`absolute inset-0 bg-gradient-to-r ${config.bg} to-transparent opacity-0 group-hover:opacity-10 transition-opacity`}></div>
                    
                    <div className="flex items-center gap-4 p-4">
                         <div className={`w-16 h-16 rounded-xl bg-opacity-20 border border-opacity-50 flex items-center justify-center transition-shadow ${config.bg} ${config.border} shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
                            <Dice5 size={32} className={config.color} />
                         </div>
                         <div className="flex-1">
                            <h4 className={`text-lg font-bold text-white mb-1 group-hover:${config.color} transition-colors`}>Neon Dice</h4>
                            <p className="text-xs text-slate-400 mb-2">Predict High, Low or 7.</p>
                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold text-slate-300 border border-white/20 px-2 py-0.5 rounded`}>PROBABLY FAIR</span>
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
