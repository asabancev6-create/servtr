import React, { useState, useEffect } from 'react';
import { PlayerState, GlobalStats, TelegramUser } from '../types';
import { ACHIEVEMENTS, formatHashValue, calculateLevel } from '../constants';
import { UserCircle2, Trophy, BarChart3, Pickaxe, Zap, Crown, CheckCircle2, Wallet, ArrowRightLeft, Lock, ArrowDown, RefreshCw, Star, Droplets, Gauge, Award, Gem } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ProfileProps {
  playerState: PlayerState;
  globalStats: GlobalStats;
  onExchange?: (amount: number, type: 'buy' | 'sell') => void;
  onClaimAchievement?: (id: string) => void;
}

const iconMap: Record<string, React.ReactNode> = {
  'Pickaxe': <Pickaxe size={24} />,
  'Zap': <Zap size={24} />,
  'Crown': <Crown size={24} />,
  'Award': <Award size={24} />,
  'Star': <Star size={24} />,
  'Trophy': <Trophy size={24} />,
  'Gem': <Gem size={24} />,
};

// Small header map
const headerIconMap: Record<string, React.ReactNode> = {
  'Pickaxe': <Pickaxe size={14} className="text-neuro-cyan" />,
  'Zap': <Zap size={14} className="text-neuro-pink" />,
  'Crown': <Crown size={14} className="text-neuro-gold" />,
  'Award': <Award size={14} className="text-orange-400" />,
  'Star': <Star size={14} className="text-neuro-cyan" />,
  'Trophy': <Trophy size={14} className="text-neuro-gold" />,
  'Gem': <Gem size={14} className="text-neuro-pink" />,
};

const Profile: React.FC<ProfileProps> = ({ playerState, globalStats, onExchange, onClaimAchievement }) => {
  const { t, language } = useLanguage();
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [exchangeMode, setExchangeMode] = useState<'sell' | 'buy'>('sell');
  const [inputAmount, setInputAmount] = useState<string>('');

  useEffect(() => {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        setUser(window.Telegram.WebApp.initDataUnsafe.user);
    } else {
        setUser({ id: 12345678, first_name: "Pilot", username: "crypto_miner" });
    }
  }, []);

  // --- LEVEL LOGIC ---
  const lifetimeHashes = Math.max(0, playerState.lifetimeHashes || 0);
  const currentLevel = calculateLevel(lifetimeHashes);
  
  const totalHashesForCurrentLevel = 100 * (Math.pow(2, currentLevel) - 1);
  const totalHashesForNextLevel = 100 * (Math.pow(2, currentLevel + 1) - 1);
  const hashesNeededForNext = totalHashesForNextLevel - totalHashesForCurrentLevel;
  const hashesProgressInLevel = lifetimeHashes - totalHashesForCurrentLevel;
  const levelProgressPercent = hashesNeededForNext > 0 ? Math.min(100, Math.max(0, (hashesProgressInLevel / hashesNeededForNext) * 100)) : 100;

  // --- ACHIEVEMENT HIGHEST BADGE LOGIC ---
  const highestClaimedIndex = ACHIEVEMENTS.reduce((maxIndex, ach, idx) => {
      const record = playerState.achievements[ach.id];
      if (record && record.claimed) {
          return idx > maxIndex ? idx : maxIndex;
      }
      return maxIndex;
  }, -1);

  const highestBadge = highestClaimedIndex > -1 ? ACHIEVEMENTS[highestClaimedIndex] : null;

  const isPremium = playerState.premiumUntil > Date.now();
  const numericAmount = parseFloat(inputAmount) || 0;
  const currentPrice = globalStats.currentPrice;
  const liquidityPool = globalStats.rewardPoolNrc || 0;
  const { maxDailySell, maxDailyBuy } = globalStats.exchangeConfig;

  const todaySold = playerState.dailySoldNrc || 0;
  const remainingSellDaily = Math.max(0, maxDailySell - todaySold);

  const todayBought = playerState.dailyBoughtNrc || 0;
  const remainingBuyDaily = Math.max(0, maxDailyBuy - todayBought);

  let outputAmount = 0;
  let isValid = false;
  let validationMessage = t('profile.exchange.enter_amount');

  if (exchangeMode === 'sell') {
      outputAmount = numericAmount * currentPrice;
      if (numericAmount > 0) {
          if (!isPremium) {
              isValid = false;
              validationMessage = t('profile.premium');
          } else if (numericAmount > remainingSellDaily) {
              isValid = false;
              validationMessage = t('profile.exchange.limit_exceeded');
          } else if (numericAmount > playerState.balance) {
              isValid = false;
              validationMessage = t('profile.exchange.insufficient_nrc');
          } else {
              isValid = true;
          }
      }
  } else {
      if (liquidityPool <= 0) {
          outputAmount = 0;
          isValid = false;
          validationMessage = t('profile.exchange.pool_empty');
      } else {
          outputAmount = numericAmount / currentPrice;
          
          if (numericAmount > 0) {
              if (!isPremium) {
                 isValid = false;
                 validationMessage = t('profile.premium');
              } else if (numericAmount > remainingBuyDaily) {
                  isValid = false;
                  validationMessage = t('profile.exchange.limit_exceeded');
              } else if (numericAmount > playerState.tonBalance) {
                  isValid = false;
                  validationMessage = t('profile.exchange.insufficient_ton');
              } else if (outputAmount > liquidityPool) {
                  isValid = false;
                  validationMessage = t('profile.exchange.pool_empty'); 
              } else {
                  isValid = true;
              }
          }
      }
  }

  const handleMax = () => {
      if (exchangeMode === 'sell') {
          const maxSell = Math.min(playerState.balance, remainingSellDaily);
          setInputAmount(Math.floor(maxSell).toString());
      } else {
          const maxTonByBalance = playerState.tonBalance;
          const maxTonByPool = liquidityPool * currentPrice;
          const maxTonByLimit = remainingBuyDaily * currentPrice;
          const safeMax = Math.min(maxTonByBalance, maxTonByPool, maxTonByLimit);
          if (safeMax < 0.000001) setInputAmount('0');
          else setInputAmount(safeMax.toFixed(4));
      }
  };

  const toggleMode = (mode: 'sell' | 'buy') => {
      setExchangeMode(mode);
      setInputAmount('');
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn p-4 pb-32">
       {/* User Header */}
       <div className={`flex items-center gap-4 glass-card p-4 rounded-2xl relative overflow-hidden border ${isPremium ? 'border-neuro-gold/50 shadow-[0_0_20px_rgba(255,184,0,0.2)]' : 'border-white/5'}`}>
          <div className="absolute right-0 top-0 w-32 h-32 bg-neuro-gradient-primary opacity-10 rounded-bl-full pointer-events-none"></div>
          
          <div className={`w-16 h-16 rounded-full p-[2px] shadow-glow relative z-10 ${isPremium ? 'bg-neuro-gold' : 'bg-neuro-gradient-primary'}`}>
             {user?.photo_url ? (
               <img src={user.photo_url} alt="Profile" className="w-full h-full rounded-full bg-black object-cover" />
             ) : (
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                    <UserCircle2 size={40} className="text-white" />
                </div>
             )}
             {isPremium && (
                 <div className="absolute -bottom-1 -right-1 bg-neuro-gold text-black rounded-full p-1 border-2 border-black">
                     <Star size={12} fill="black" />
                 </div>
             )}
          </div>
          <div className="relative z-10">
             <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                    {user?.first_name} {user?.last_name || ''}
                    {highestBadge && (
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 border border-white/20 shadow-sm animate-pulse-slow">
                             {headerIconMap[highestBadge.icon]}
                        </div>
                    )}
                </h2>
                {isPremium && <span className="text-[9px] font-bold bg-neuro-gold text-black px-1.5 py-0.5 rounded">{t('profile.premium')}</span>}
             </div>
             
             <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-neuro-violet/20 text-neuro-violet px-2 py-0.5 rounded font-mono border border-neuro-violet/20 font-bold">{t('common.lvl')} {currentLevel}</span>
                <span className="text-xs text-slate-400 font-mono">{t('common.id')}: #{user?.id}</span>
             </div>
          </div>
       </div>

       {/* Personal Stats */}
       <div className="grid grid-cols-2 gap-4">
          <div className="glass-card rounded-xl p-4 flex flex-col items-center text-center border border-white/5">
             <div className="w-10 h-10 rounded-full bg-neuro-gold/10 flex items-center justify-center text-neuro-gold mb-2 shadow-[0_0_15px_rgba(255,184,0,0.2)]">
                <Trophy size={20}/> 
             </div>
             <div className="text-slate-400 text-xs mb-1 font-bold uppercase">{t('profile.totalMined')}</div>
             <div className="text-white font-mono font-bold text-lg">
                {Math.floor(playerState.balance).toLocaleString()}
             </div>
          </div>
          <div className="glass-card rounded-xl p-4 flex flex-col items-center text-center border border-white/5">
             <div className="w-10 h-10 rounded-full bg-neuro-pink/10 flex items-center justify-center text-neuro-pink mb-2 shadow-[0_0_15px_rgba(255,0,229,0.2)]">
                <BarChart3 size={20}/> 
             </div>
             <div className="text-slate-400 text-xs mb-1 font-bold uppercase">{t('profile.rank')}</div>
             <div className="text-neuro-pink font-mono font-bold text-lg">Top 5%</div>
          </div>
       </div>

       {/* LEVEL PROGRESS CARD */}
       <div className="glass-card rounded-xl p-5 border border-neuro-violet/20 bg-neuro-violet/5">
           <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-white text-sm flex items-center gap-2 uppercase tracking-wider">
                    <Gauge size={18} className="text-neuro-violet" /> {t('profile.lvl_progress')}
                </h3>
                <span className="text-xs font-mono font-bold text-neuro-violet">{t('common.lvl')} {currentLevel}</span>
           </div>
           
           <div className="h-2 w-full bg-black rounded-full overflow-hidden border border-white/5 mb-2">
                <div 
                    className="h-full bg-neuro-gradient-secondary transition-all duration-1000 ease-out shadow-[0_0_10px_#8D73FF]"
                    style={{ width: `${levelProgressPercent}%` }}
                ></div>
           </div>
           
           <div className="flex justify-between text-[9px] font-mono font-bold text-slate-500 uppercase">
               <span>{formatHashValue(lifetimeHashes)} {t('profile.total_hash')}</span>
               <span>{t('profile.next_lvl')}: {formatHashValue(totalHashesForNextLevel)}</span>
           </div>
       </div>

       {/* Trophies List */}
       <div className="glass-card rounded-xl p-5 border border-neuro-violet/20">
          <h3 className="font-bold text-white mb-5 text-base flex items-center gap-2 uppercase tracking-wider pl-1">
            <Trophy size={18} className="text-neuro-gold" /> {t('profile.trophies')}
          </h3>
          <div className="space-y-4">
             {ACHIEVEMENTS.map((ach) => {
               const record = playerState.achievements[ach.id];
               const unlocked = record?.unlocked || false;
               const claimed = record?.claimed || false;
               
               let progress = 0;
               if (ach.type === 'balance') progress = Math.min((playerState.balance / ach.threshold) * 100, 100);
               else if (ach.type === 'clickPower') progress = Math.min((playerState.clickPower / ach.threshold) * 100, 100);
               else if (ach.type === 'level') progress = Math.min((currentLevel / ach.threshold) * 100, 100);

               return (
                 <div key={ach.id} className="relative bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col gap-3 overflow-hidden group hover:border-neuro-gold/30 transition-all">
                    {/* Progress Bar Background (Subtle) */}
                    <div className="absolute bottom-0 left-0 h-1 bg-black/50 w-full">
                       <div className={`h-full transition-all duration-1000 ${unlocked ? 'bg-neuro-gold' : 'bg-neuro-violet'}`} style={{ width: `${progress}%` }}></div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className={`
                            w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0 transition-all duration-300
                            ${unlocked 
                                ? 'bg-neuro-gold/20 border-neuro-gold text-neuro-gold shadow-[0_0_20px_rgba(255,184,0,0.3)]' 
                                : 'bg-black/40 border-white/10 text-slate-600 grayscale'}
                        `}>
                            {iconMap[ach.icon]}
                        </div>

                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <h4 className={`text-base font-bold ${unlocked ? 'text-white' : 'text-slate-300'} mb-1`}>
                                    {ach.name[language]}
                                </h4>
                                {claimed && <CheckCircle2 size={20} className="text-neuro-green text-[#00ff41] drop-shadow-[0_0_5px_rgba(0,255,65,0.6)]" />}
                            </div>
                            
                            <p className="text-xs text-slate-500 leading-snug mb-2 font-sans">
                                {ach.description[language]}
                            </p>

                            <div className="flex items-center justify-between mt-1">
                                {!unlocked && (
                                    <span className="text-[10px] font-mono text-slate-600">
                                        {Math.floor(progress)}%
                                    </span>
                                )}

                                {unlocked && !claimed ? (
                                    <button 
                                        onClick={() => onClaimAchievement && onClaimAchievement(ach.id)}
                                        className="bg-neuro-gold text-black px-3 py-1.5 rounded-lg text-xs font-bold shadow-[0_0_15px_rgba(255,184,0,0.5)] hover:bg-[#ffc833] animate-pulse-slow"
                                    >
                                        CLAIM +{ach.reward}
                                    </button>
                                ) : (
                                    /* Reward Badge Static */
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors ${claimed ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-white/5 border-white/10'}`}>
                                        <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">
                                            {claimed ? t('profile.completed') : t('profile.reward')}
                                        </span>
                                        {!claimed && <span className="text-xs font-mono font-bold text-slate-200">{ach.reward}</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                 </div>
               );
             })}
          </div>
       </div>

    </div>
  );
};

export default Profile;