import React, { useState, useEffect } from 'react';
import { COLLECTIONS } from '../constants';
import { Box, Key, Brain, Cpu, Lock, Gem, CheckCircle2, Clipboard, Share2, Users, Coins, Gift, Calendar, ArrowRight, AlertTriangle, Clock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { GameService } from '../services/mockBackend';
import { PlayerState, Quest, GlobalStats } from '../types';

const iconMap: Record<string, React.ReactNode> = {
  'Box': <Box size={24} />,
  'Key': <Key size={24} />,
  'Brain': <Brain size={24} />,
  'Cpu': <Cpu size={24} />,
};

const rarityStyles: Record<string, string> = {
    'Common': 'border-slate-700 bg-slate-900/50 text-slate-300',
    'Rare': 'border-neuro-cyan/50 bg-neuro-cyan/10 text-neuro-cyan shadow-[0_0_10px_rgba(0,240,255,0.1)]',
    'Legendary': 'border-neuro-gold/50 bg-neuro-gold/10 text-neuro-gold shadow-[0_0_15px_rgba(255,184,0,0.2)]',
    'Quantum': 'border-neuro-pink/50 bg-neuro-pink/10 text-neuro-pink shadow-[0_0_20px_rgba(255,0,229,0.2)]',
};

type CollectionTab = 'nft' | 'quests' | 'pool';

interface CollectionsProps {
  playerState: PlayerState;
  onUpdate: (newState: PlayerState) => void;
}

const Collections: React.FC<CollectionsProps> = ({ playerState, onUpdate }) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<CollectionTab>('quests');
  // Note: playerState is now a prop, not local state, preventing sync issues
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [timeUntilNext, setTimeUntilNext] = useState<string>('');
  const [dailyReady, setDailyReady] = useState(false);
  const [copied, setCopied] = useState(false);

  // Refresh global stats and calculate timers based on props
  useEffect(() => {
    const update = () => {
        // Only fetch global stats here, player state comes from props
        const global = GameService.getGlobalStats(0);
        setGlobalStats(global);
        
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const diff = now - playerState.lastDailyRewardClaim;
        
        if (diff >= oneDay) {
            setDailyReady(true);
            setTimeUntilNext('');
        } else {
            setDailyReady(false);
            const remaining = oneDay - diff;
            const h = Math.floor(remaining / (1000 * 60 * 60));
            const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((remaining % (1000 * 60)) / 1000);
            setTimeUntilNext(`${h}h ${m}m ${s}s`);
        }
    };
    update();
    const interval = setInterval(update, 1000); // 1s sync for timer
    return () => clearInterval(interval);
  }, [playerState.lastDailyRewardClaim]); // Depend on prop changes

  const handleClaimDaily = () => {
    if (!globalStats) return;
    
    const result = GameService.claimDailyReward(playerState);
    if (result.success && result.newState) {
        onUpdate(result.newState); // Notify parent immediately
        setDailyReady(false);
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        alert(`+${Math.floor(result.reward || 0)} NRC!`);
    } else {
        if (result.error === 'POOL EMPTY') alert(t('collections.pool_empty'));
        else if (result.error === 'COOLDOWN') alert(t('collections.come_back'));
        
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        }
    }
  };

  const handleQuestAction = (quest: Quest) => {
      // Re-check quest condition manually in case UI is stale
      if (quest.type === 'check' || quest.type === 'game') {
           if (quest.condition && !quest.condition(playerState)) return;
      }
      
      const performComplete = () => {
          const result = GameService.completeQuest(playerState, quest.id, quest.reward);
             if (result.success && result.newState) {
                onUpdate(result.newState); // Notify parent immediately
                if (window.Telegram?.WebApp?.HapticFeedback) {
                   window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                }
             } else {
                 if (result.error === 'POOL_EMPTY') alert(t('collections.pool_empty'));
                 if (result.error === 'ALREADY_COMPLETED') alert(t('collections.claimed'));
             }
      }

      // Perform action
      if (quest.type === 'social' && quest.link) {
          window.open(quest.link, '_blank');
          setTimeout(performComplete, 2000);
      } else {
          performComplete();
      }
  };

  const copyReferral = () => {
      const refLink = `https://t.me/neurocoin_bot?start=ref_${window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '123'}`;
      navigator.clipboard.writeText(refLink);
      setCopied(true);
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      }
      setTimeout(() => setCopied(false), 2000);
  };

  const renderNFTs = () => (
    <div className="grid grid-cols-2 gap-3">
        {COLLECTIONS.map((item) => (
            <div 
                key={item.id}
                className={`
                    relative aspect-square rounded-xl border p-4 flex flex-col justify-between
                    backdrop-blur-md transition-all duration-300 hover:scale-[1.02]
                    ${item.unlocked ? rarityStyles[item.rarity] : 'glass-card border-white/5 opacity-50'}
                `}
            >
                {!item.unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 backdrop-blur-sm rounded-xl">
                        <Lock className="text-slate-500" />
                    </div>
                )}
                
                <div className="flex justify-between items-start">
                    <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm bg-black/40 ${item.unlocked ? '' : 'text-slate-500'}`}>
                        {item.rarity}
                    </span>
                </div>

                <div className={`self-center ${item.unlocked ? 'drop-shadow-[0_0_8px_currentColor]' : 'grayscale'}`}>
                    {iconMap[item.icon]}
                </div>

                <div>
                    <h4 className="font-bold text-sm leading-tight text-white mb-1">{item.name[language]}</h4>
                    <p className="text-[10px] leading-tight opacity-70 line-clamp-2 font-sans">{item.description[language]}</p>
                </div>
            </div>
        ))}
    </div>
  );

  const renderQuests = () => {
      if (!globalStats) return <div>{t('common.loading')}</div>;
      
      const poolAmount = globalStats.rewardPoolNrc;
      const dailyRewardAmount = globalStats.baseDailyReward;

      return (
        <div className="flex flex-col gap-4">
            {/* Daily Reward Card */}
            <div className="glass-card rounded-xl p-5 border border-neuro-gold/30 bg-gradient-to-br from-neuro-gold/10 to-transparent relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Calendar size={64} className="text-neuro-gold" />
                </div>
                
                <div className="relative z-10">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                        <Gift className="text-neuro-gold" size={20} /> {t('collections.daily_title')}
                    </h3>
                    <p className="text-xs text-slate-300 mb-4 max-w-[80%]">{t('collections.daily_desc')}</p>
                    
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-mono font-bold text-white">
                                    {dailyRewardAmount}
                                </span>
                                <span className="text-xs font-bold text-neuro-gold">NRC</span>
                            </div>
                        </div>

                        <button
                            onClick={handleClaimDaily}
                            disabled={!dailyReady || poolAmount < dailyRewardAmount}
                            className={`
                                px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all
                                flex items-center gap-2
                                ${dailyReady && poolAmount >= dailyRewardAmount
                                    ? 'bg-neuro-gold text-black hover:bg-[#ffc833] shadow-[0_0_15px_rgba(255,184,0,0.5)]' 
                                    : 'bg-white/10 text-slate-500 cursor-not-allowed border border-white/5'}
                            `}
                        >
                            {poolAmount < dailyRewardAmount 
                                ? t('collections.pool_empty') 
                                : (dailyReady 
                                    ? t('collections.claim') 
                                    : <><Clock size={12}/> {timeUntilNext}</>)
                            }
                        </button>
                    </div>
                </div>
            </div>

            {/* Tasks List */}
            <div>
                <div className="flex justify-between items-center mb-3 pl-1 pr-1">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t('collections.tasks_title')}</h3>
                </div>

                <div className="flex flex-col gap-3">
                    {globalStats.quests.map((quest) => {
                        const completed = playerState.completedQuestIds.includes(quest.id);
                        const canComplete = quest.condition ? quest.condition(playerState) : true;
                        const poolHasFunds = poolAmount >= quest.reward;

                        return (
                            <div key={quest.id} className={`glass-card rounded-xl p-3 flex items-center justify-between border ${completed ? 'border-green-500/20 bg-green-500/5' : 'border-white/5'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${completed ? 'bg-green-500/20 text-green-500' : 'bg-neuro-violet/20 text-neuro-violet'}`}>
                                        {completed ? <CheckCircle2 size={18} /> : <Coins size={18} />}
                                    </div>
                                    <div className={`${completed ? 'opacity-50' : ''}`}>
                                        <h4 className="font-bold text-sm text-white leading-none mb-1">{quest.title[language]}</h4>
                                        <span className="text-[10px] font-bold text-neuro-cyan flex items-center gap-1">
                                            +{quest.reward} NRC
                                        </span>
                                    </div>
                                </div>

                                {completed ? (
                                    <div className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded border border-green-500/20 uppercase flex items-center gap-1">
                                        <CheckCircle2 size={10} /> {t('common.done')}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleQuestAction(quest)}
                                        disabled={!poolHasFunds || (!canComplete && quest.type !== 'social')}
                                        className={`
                                            p-2 rounded-lg transition-all
                                            ${(quest.type === 'social' || canComplete) && poolHasFunds
                                                ? 'bg-white/10 text-white hover:bg-white/20' 
                                                : 'bg-transparent text-slate-600 cursor-not-allowed border border-white/5'}
                                        `}
                                    >
                                        {!poolHasFunds ? <AlertTriangle size={16} className="text-red-500"/> : <ArrowRight size={16} />}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    
                    {globalStats.quests.length === 0 && (
                        <div className="text-center text-slate-500 text-xs py-4">
                            {t('collections.no_quests')}
                        </div>
                    )}
                </div>
            </div>
        </div>
      );
  }

  const renderPool = () => (
      <div className="flex flex-col gap-5">
           {/* Invite Banner */}
           <div className="glass-card rounded-2xl p-6 border border-neuro-cyan/30 text-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle,_rgba(0,240,255,0.1)_0%,_transparent_70%)]"></div>
               
               <div className="relative z-10">
                   <div className="w-16 h-16 mx-auto rounded-full bg-neuro-cyan/20 flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(0,240,255,0.3)]">
                       <Users size={32} className="text-neuro-cyan" />
                   </div>
                   <h3 className="text-xl font-bold text-white mb-2">{t('collections.ref_title')}</h3>
                   <p className="text-sm text-slate-300 mb-6">{t('collections.ref_desc')}</p>

                   <div className="bg-black/40 rounded-xl p-2 flex items-center justify-between border border-white/10 mb-2">
                       <span className="text-[10px] text-slate-500 font-mono px-2 truncate max-w-[200px]">
                            https://t.me/neurocoin_bot?start=ref_{window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '...'}
                       </span>
                       <button 
                         onClick={copyReferral}
                         className="bg-neuro-cyan/20 text-neuro-cyan hover:bg-neuro-cyan/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                       >
                           {copied ? t('collections.ref_copied') : t('collections.ref_copy')}
                       </button>
                   </div>
                   
                   <button 
                        onClick={() => {
                            const link = `https://t.me/share/url?url=https://t.me/neurocoin_bot?start=ref_${window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '123'}&text=Join NeuroCoin and mine crypto!`;
                            window.open(link, '_blank');
                        }}
                        className="w-full py-3 bg-neuro-cyan text-black font-bold rounded-xl shadow-[0_0_15px_rgba(0,240,255,0.5)] flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                   >
                       <Share2 size={16} /> {t('collections.invite_btn')}
                   </button>
               </div>
           </div>

           {/* Stats Grid */}
           <div>
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 pl-1">{t('collections.ref_stats')}</h3>
               <div className="grid grid-cols-2 gap-3">
                   <div className="glass-card p-4 rounded-xl border border-white/5">
                       <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{t('collections.ref_count')}</div>
                       <div className="text-2xl font-mono font-bold text-white">{playerState.referrals}</div>
                   </div>
                   <div className="glass-card p-4 rounded-xl border border-neuro-gold/20 bg-neuro-gold/5">
                       <div className="text-[10px] text-neuro-gold uppercase font-bold mb-1">{t('collections.ref_earn')}</div>
                       <div className="text-2xl font-mono font-bold text-white">{playerState.referralEarnings} NRC</div>
                   </div>
               </div>
           </div>
           
           {/* Pool Reward Info */}
           <div className="glass-card p-4 rounded-xl border border-white/5 flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-neuro-violet/20 flex items-center justify-center">
                   <Coins className="text-neuro-violet" size={20} />
               </div>
               <div>
                   <h4 className="font-bold text-white text-sm">{t('collections.pool_reward')}</h4>
                   <p className="text-xs text-slate-400">{t('collections.pool_info')}</p>
               </div>
           </div>
      </div>
  );

  return (
    <div className="flex flex-col gap-6 animate-fadeIn p-4 pb-32">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-sans font-bold text-white flex items-center gap-2">
            <Gem className="text-neuro-pink" /> 
            <span className="gradient-text">{t('collections.title')}</span>
        </h2>
        <p className="text-slate-400 text-sm">{t('collections.subtitle')}</p>
      </div>

      {/* Internal Navigation */}
      <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 z-20 relative">
        {(['quests', 'nft', 'pool'] as CollectionTab[]).map((tab) => (
            <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === tab ? 'bg-neuro-pink text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
                {t(`collections.tabs.${tab}`)}
            </button>
        ))}
      </div>

      {/* Content */}
      <div className="animate-fadeIn">
          {activeTab === 'quests' && renderQuests()}
          {activeTab === 'nft' && renderNFTs()}
          {activeTab === 'pool' && renderPool()}
      </div>
    </div>
  );
};

export default Collections;