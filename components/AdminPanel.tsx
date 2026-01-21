import React, { useState, useEffect } from 'react';
import { GlobalStats, Quest } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { ShieldCheck, Users, Globe, Wallet, Droplets, ArrowDown, PieChart, Coins, Sliders, Plus, Trash2, Calendar, CheckSquare, ArrowRightLeft } from 'lucide-react';
import { GameService } from '../services/mockBackend';
import { MAX_SUPPLY } from '../constants';

interface AdminPanelProps {
  globalStats: GlobalStats;
  onClose: () => void;
  onRefresh: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ globalStats, onClose, onRefresh }) => {
  const { t } = useLanguage();
  const [injectAmount, setInjectAmount] = useState<string>('');
  
  // Reward Config State
  const [poolPct, setPoolPct] = useState(globalStats.rewardConfig.poolPercent);
  const [closerPct, setCloserPct] = useState(globalStats.rewardConfig.closerPercent);
  const [contribPct, setContribPct] = useState(globalStats.rewardConfig.contributorPercent);
  
  // Daily Reward Config
  const [baseDaily, setBaseDaily] = useState<string>(globalStats.baseDailyReward.toString());

  // Exchange Limits
  const [maxSell, setMaxSell] = useState<string>(globalStats.exchangeConfig.maxDailySell.toString());
  const [maxBuy, setMaxBuy] = useState<string>(globalStats.exchangeConfig.maxDailyBuy.toString());

  // New Quest State
  const [newQuestTitle, setNewQuestTitle] = useState('');
  const [newQuestReward, setNewQuestReward] = useState('5');
  const [newQuestType, setNewQuestType] = useState<'social' | 'game' | 'check'>('social');

  useEffect(() => {
    setPoolPct(globalStats.rewardConfig.poolPercent);
    setCloserPct(globalStats.rewardConfig.closerPercent);
    setContribPct(globalStats.rewardConfig.contributorPercent);
    setBaseDaily(globalStats.baseDailyReward.toString());
    setMaxSell(globalStats.exchangeConfig.maxDailySell.toString());
    setMaxBuy(globalStats.exchangeConfig.maxDailyBuy.toString());
  }, [globalStats]);

  const emissionPercent = (globalStats.totalMined / MAX_SUPPLY) * 100;
  
  const handleInject = () => {
      const val = parseFloat(injectAmount);
      if (val > 0 && val <= globalStats.treasuryTon) {
          const success = GameService.injectLiquidity(val);
          if (success) {
              setInjectAmount('');
              onRefresh();
              if (window.Telegram?.WebApp?.HapticFeedback) {
                  window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
              }
          }
      }
  };

  const handleConfigSave = () => {
      const total = poolPct + closerPct + contribPct;
      if (total === 100) {
          GameService.updateRewardConfig({
              poolPercent: poolPct,
              closerPercent: closerPct,
              contributorPercent: contribPct
          });
          onRefresh();
          if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          }
      } else {
          alert(`Error: Total must be 100% (Current: ${total}%)`);
      }
  };

  const handleSaveDaily = () => {
      const val = parseInt(baseDaily);
      if (val >= 0) {
          GameService.updateBaseDailyReward(val);
          onRefresh();
          if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          }
      }
  };

  const handleSaveExchangeLimits = () => {
      const s = parseInt(maxSell);
      const b = parseInt(maxBuy);
      if (s >= 0 && b >= 0) {
          GameService.updateExchangeConfig({
              maxDailySell: s,
              maxDailyBuy: b
          });
          onRefresh();
          if (window.Telegram?.WebApp?.HapticFeedback) {
             window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          }
      }
  };

  const handleAddQuest = () => {
      if (!newQuestTitle) return;
      
      const newQuest: Quest = {
          id: `quest_${Date.now()}`,
          title: { en: newQuestTitle, ru: newQuestTitle }, // Simplified for mock
          reward: parseInt(newQuestReward) || 5,
          type: newQuestType,
          link: newQuestType === 'social' ? 'https://telegram.org' : undefined
      };
      
      GameService.addQuest(newQuest);
      setNewQuestTitle('');
      onRefresh();
      if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
  };

  const handleDeleteQuest = (id: string) => {
      GameService.deleteQuest(id);
      onRefresh();
      if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
      }
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn p-4 pb-32">
        
        {/* Header */}
        <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-sans font-bold text-white flex items-center gap-2">
                <ShieldCheck className="text-red-500" /> 
                <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                    {t('admin.title')}
                </span>
            </h2>
            <p className="text-slate-400 text-sm">{t('admin.subtitle')}</p>
        </div>

        {/* EXCHANGE LIMIT CONFIG */}
        <div className="glass-card p-5 rounded-xl border border-white/20 bg-white/5">
             <div className="flex items-center gap-2 mb-3 text-white">
                <ArrowRightLeft size={20} />
                <span className="text-xs font-bold uppercase tracking-wider">{t('admin.exchange_limits')}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase">{t('admin.max_sell')}</label>
                    <input 
                        type="number" 
                        value={maxSell}
                        onChange={e => setMaxSell(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded px-2 py-2 text-white font-mono text-sm"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase">{t('admin.max_buy')}</label>
                    <input 
                        type="number" 
                        value={maxBuy}
                        onChange={e => setMaxBuy(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded px-2 py-2 text-white font-mono text-sm"
                    />
                </div>
            </div>
            <button 
                onClick={handleSaveExchangeLimits}
                className="w-full bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-xs font-bold border border-white/5 transition-colors"
            >
                {t('admin.update_limits')}
            </button>
        </div>

        {/* DAILY REWARD CONFIG */}
        <div className="glass-card p-5 rounded-xl border border-neuro-gold/30 bg-neuro-gold/5">
             <div className="flex items-center gap-2 mb-2 text-neuro-gold">
                <Calendar size={20} />
                <span className="text-xs font-bold uppercase tracking-wider">{t('admin.base_daily')}</span>
            </div>
            <div className="flex gap-2">
                <input 
                    type="number" 
                    value={baseDaily}
                    onChange={e => setBaseDaily(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded px-2 py-1 text-white font-mono"
                />
                <button onClick={handleSaveDaily} className="bg-neuro-gold/20 text-neuro-gold border border-neuro-gold/30 px-3 py-1 rounded text-xs font-bold">
                    {t('admin.update')}
                </button>
            </div>
        </div>

        {/* QUEST MANAGEMENT */}
        <div className="glass-card p-5 rounded-xl border border-blue-500/30 bg-blue-500/5">
             <div className="flex items-center gap-2 mb-4 text-blue-400">
                <CheckSquare size={20} />
                <span className="text-xs font-bold uppercase tracking-wider">{t('admin.quest_management')}</span>
            </div>

            {/* Add New */}
            <div className="flex flex-col gap-2 mb-4 bg-black/40 p-3 rounded-lg">
                <input 
                    type="text" 
                    placeholder={t('admin.quest_title')}
                    value={newQuestTitle}
                    onChange={e => setNewQuestTitle(e.target.value)}
                    className="bg-transparent border-b border-white/20 text-sm p-1 outline-none text-white"
                />
                <div className="flex gap-2">
                    <input 
                        type="number" 
                        value={newQuestReward}
                        onChange={e => setNewQuestReward(e.target.value)}
                        className="bg-transparent border-b border-white/20 text-sm p-1 outline-none text-white w-20"
                        placeholder={t('admin.reward_amount')}
                    />
                    <select 
                        value={newQuestType}
                        onChange={e => setNewQuestType(e.target.value as any)}
                        className="bg-black text-white text-xs border border-white/20 rounded"
                    >
                        <option value="social">Social</option>
                        <option value="game">Game</option>
                        <option value="check">Check</option>
                    </select>
                    <button 
                        onClick={handleAddQuest}
                        className="bg-blue-500 text-white rounded px-2 py-1 text-xs font-bold"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                {globalStats.quests.map(q => (
                    <div key={q.id} className="flex justify-between items-center bg-white/5 p-2 rounded text-xs">
                        <div>
                            <div className="font-bold text-white">{q.title.en}</div>
                            <div className="text-neuro-cyan">{q.reward} NRC</div>
                        </div>
                        <button onClick={() => handleDeleteQuest(q.id)} className="text-red-500 hover:text-red-400">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
                
                {globalStats.quests.length === 0 && (
                    <div className="text-center text-slate-500 text-xs py-2">{t('admin.no_quests')}</div>
                )}
            </div>
        </div>

        {/* TOP METRICS */}
        <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                <div className="flex items-center gap-2 mb-2 text-red-400">
                    <Users size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('admin.users')}</span>
                </div>
                <div className="text-2xl font-mono font-bold text-white">{globalStats.totalUsers.toLocaleString()}</div>
            </div>
            
            <div className="glass-card p-4 rounded-xl border border-white/5">
                <div className="flex items-center gap-2 mb-2 text-neuro-cyan">
                    <PieChart size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('admin.mined_percent')}</span>
                </div>
                <div className="text-2xl font-mono font-bold text-white">{emissionPercent.toFixed(4)}%</div>
                <div className="text-[10px] text-slate-500">{globalStats.totalMined.toLocaleString()} / {MAX_SUPPLY/1000000}M</div>
            </div>
        </div>

        {/* REWARD CONFIGURATION */}
        <div className="glass-card p-5 rounded-xl border border-neuro-violet/30 bg-neuro-violet/5">
            <div className="flex items-center gap-2 mb-4 text-neuro-violet">
                <Sliders size={20} />
                <span className="text-xs font-bold uppercase tracking-wider">{t('admin.reward_dist')}</span>
            </div>

            <div className="space-y-4">
                {/* Pool Slider */}
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                        <span className="text-neuro-gold">{t('admin.dist_pool')}</span>
                        <span className="text-white">{poolPct}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="100" value={poolPct} 
                        onChange={(e) => setPoolPct(parseInt(e.target.value))}
                        className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-neuro-gold"
                    />
                </div>

                {/* Closer Slider */}
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                        <span className="text-neuro-cyan">{t('admin.dist_closer')}</span>
                        <span className="text-white">{closerPct}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="100" value={closerPct} 
                        onChange={(e) => setCloserPct(parseInt(e.target.value))}
                        className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-neuro-cyan"
                    />
                </div>

                {/* Contributor Slider */}
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                        <span className="text-neuro-pink">{t('admin.dist_contrib')}</span>
                        <span className="text-white">{contribPct}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="100" value={contribPct} 
                        onChange={(e) => setContribPct(parseInt(e.target.value))}
                        className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-neuro-pink"
                    />
                </div>

                <div className="flex justify-between items-center pt-2">
                    <span className={`text-[10px] font-bold ${poolPct + closerPct + contribPct === 100 ? 'text-green-500' : 'text-red-500'}`}>
                        TOTAL: {poolPct + closerPct + contribPct}%
                    </span>
                    <button 
                        onClick={handleConfigSave}
                        className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold border border-white/5 transition-colors"
                    >
                        {t('admin.save_config')}
                    </button>
                </div>
            </div>
        </div>

        {/* REWARD POOL DISPLAY */}
        <div className="glass-card p-5 rounded-xl border border-neuro-gold/30 bg-neuro-gold/5">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 text-neuro-gold">
                    <Coins size={20} />
                    <span className="text-xs font-bold uppercase tracking-wider">{t('admin.reward_pool')}</span>
                </div>
                <div className="bg-neuro-gold/20 text-neuro-gold px-2 py-0.5 rounded text-[9px] font-bold border border-neuro-gold/20">
                    {globalStats.rewardConfig.poolPercent}% {t('admin.pool_tax')}
                </div>
            </div>
            <div className="text-3xl font-mono font-bold text-white drop-shadow-[0_0_10px_rgba(255,184,0,0.3)]">
                {globalStats.rewardPoolNrc.toLocaleString()} <span className="text-sm">NRC</span>
            </div>
            <p className="text-[10px] text-neuro-gold/70 mt-1">{t('admin.pool_desc')}</p>
        </div>

        {/* LIQUIDITY CONTROL */}
        <div className="glass-card p-0 rounded-xl border border-white/10 overflow-hidden">
            <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Wallet size={18} className="text-slate-400"/>
                    <span className="text-sm font-bold text-white uppercase">{t('admin.treasury_title')}</span>
                </div>
            </div>

            <div className="p-5 flex flex-col gap-6">
                
                {/* Balances */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-bold mb-1">{t('admin.treasury')} (90%)</span>
                        <span className="text-xl font-mono font-bold text-white">{globalStats.treasuryTon.toFixed(2)} TON</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] text-slate-500 uppercase font-bold mb-1">{t('admin.liquidity')} (10%)</span>
                        <span className="text-xl font-mono font-bold text-neuro-cyan">{globalStats.liquidityTon.toFixed(2)} TON</span>
                    </div>
                </div>

                {/* Injector */}
                <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                         <Droplets size={16} className="text-neuro-cyan"/>
                         <span className="text-xs font-bold text-white">{t('admin.inject_title')}</span>
                    </div>
                    
                    <div className="flex gap-2 mb-2">
                        <input 
                            type="number" 
                            className="w-full bg-black border border-white/20 rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-neuro-cyan transition-colors"
                            placeholder="Amount TON"
                            value={injectAmount}
                            onChange={(e) => setInjectAmount(e.target.value)}
                        />
                        <button 
                            onClick={() => setInjectAmount(globalStats.treasuryTon.toString())}
                            className="px-3 py-2 bg-white/10 rounded-lg text-xs font-bold hover:bg-white/20"
                        >
                            {t('common.max')}
                        </button>
                    </div>
                    
                    <button 
                        onClick={handleInject}
                        disabled={!parseFloat(injectAmount) || parseFloat(injectAmount) > globalStats.treasuryTon}
                        className={`
                            w-full py-3 rounded-lg font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all
                            ${parseFloat(injectAmount) > 0 && parseFloat(injectAmount) <= globalStats.treasuryTon
                                ? 'bg-neuro-cyan text-black hover:brightness-110 shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                                : 'bg-white/5 text-slate-600 cursor-not-allowed'}
                        `}
                    >
                        <ArrowDown size={14} /> {t('admin.add_liquidity')}
                    </button>
                </div>

                {/* Price Impact Preview */}
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                     <span>{t('admin.current_price')}:</span>
                     <span className="text-neuro-cyan font-bold">{globalStats.currentPrice.toFixed(6)} TON</span>
                </div>

            </div>
        </div>

    </div>
  );
};

export default AdminPanel;