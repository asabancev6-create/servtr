import React, { useState, useEffect } from 'react';
import { PlayerState, Upgrade } from '../types';
import { UPGRADES, formatHashValue } from '../constants';
import { Zap, Cpu, ShoppingBag, MousePointer2, Hand, Brain, Server, Warehouse, Factory, Flame, Orbit, Satellite, Dam, Star, Atom, Lock, Wallet, CircleDollarSign, Crown, Timer } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { GameService } from '../services/mockBackend';

interface ShopProps {
  playerState: PlayerState;
  onPurchase: (id: string, currency: 'TON' | 'NRC') => void;
}

const iconMap: Record<string, React.ReactNode> = {
  'Zap': <Zap size={22} />,
  'Cpu': <Cpu size={22} />,
  'MousePointer2': <MousePointer2 size={22} />,
  'Hand': <Hand size={22} />,
  'Brain': <Brain size={22} />,
  'Server': <Server size={22} />,
  'Warehouse': <Warehouse size={22} />,
  'Factory': <Factory size={22} />,
  'Dam': <Dam size={22} />,
  'Flame': <Flame size={22} />,
  'Satellite': <Satellite size={22} />,
  'Orbit': <Orbit size={22} />,
  'Star': <Star size={22} />,
  'Atom': <Atom size={22} />,
};

type ShopTab = 'clicker' | 'miners' | 'farms' | 'market';

// 3D Button Component extracted for performance and stability
const PurchaseButton = ({ 
    currency, 
    amount, 
    disabled, 
    onClick, 
    fullWidth = false 
  }: { 
    currency: 'TON' | 'NRC', 
    amount: number, 
    disabled: boolean, 
    onClick: () => void,
    fullWidth?: boolean
  }) => (
    <button
        type="button"
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        disabled={disabled}
        className={`
            group relative h-10 ${fullWidth ? 'w-full' : 'flex-1'} rounded-xl font-bold font-mono text-[10px] tracking-wider uppercase transition-all
            active:scale-[0.98] z-10
            ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer hover:brightness-110'}
        `}
    >
        {/* Shadow/Base Layer */}
        <div className={`absolute inset-0 rounded-xl translate-y-1 ${currency === 'TON' ? 'bg-[#006096]' : 'bg-[#5d3fd3]'}`}></div>
        {/* Top Layer */}
        <div className={`
            absolute inset-0 rounded-xl flex items-center justify-center gap-1.5 transition-transform active:translate-y-1
            ${currency === 'TON' ? 'bg-[#0098EA]' : 'bg-neuro-violet'}
        `}>
            {currency === 'TON' ? <Wallet size={12} className="text-white" /> : <CircleDollarSign size={12} className="text-white" />}
            <span className="text-white drop-shadow-md">
                {currency === 'TON' ? amount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : Math.floor(amount).toLocaleString()} {currency}
            </span>
        </div>
    </button>
  );

const Shop: React.FC<ShopProps> = ({ playerState, onPurchase }) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<ShopTab>('clicker');
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Premium Countdown Timer Logic
  useEffect(() => {
    const timer = setInterval(() => {
        if (playerState.premiumUntil > Date.now()) {
            const diff = playerState.premiumUntil - Date.now();
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        } else {
            setTimeLeft('');
        }
    }, 1000);
    return () => clearInterval(timer);
  }, [playerState.premiumUntil]);

  const filterUpgrades = (tab: ShopTab) => {
      return UPGRADES.filter(u => {
          if (tab === 'clicker') return u.category === 'click_device';
          if (tab === 'miners') return u.category === 'miner_device';
          if (tab === 'farms') return u.category === 'farm';
          if (tab === 'market') return u.category === 'premium' || u.category === 'limited';
          return false;
      });
  };

  const renderCost = (baseCost: number, scale: number, level: number) => {
      return baseCost * Math.pow(1 + scale, level);
  };

  const renderStandardCard = (upgrade: Upgrade) => {
      const currentLevel = playerState.upgrades[upgrade.id] || 0;
      const isMaxed = currentLevel >= upgrade.maxLevel;
      
      const costTon = renderCost(upgrade.costTon, upgrade.scaleTon, currentLevel);
      const costNrc = renderCost(upgrade.costNrc, upgrade.scaleNrc, currentLevel);
      
      const canAffordNrc = playerState.balance >= costNrc;
      const canAffordTon = true; // Always allow TON button to be clickable to trigger wallet flow

      return (
        <div 
          key={upgrade.id}
          className="glass-card rounded-xl p-5 relative overflow-visible transition-all duration-300 hover:border-neuro-violet/50"
        >
          <div className="flex items-start justify-between relative z-10 mb-2">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center border shadow-lg bg-neuro-violet/10 border-neuro-violet/20 text-neuro-violet">
                {iconMap[upgrade.icon] || <Zap />}
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight text-white">{upgrade.name[language]}</h3>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] bg-white/10 border border-white/10 px-1.5 py-0.5 rounded text-slate-300 font-mono font-bold">
                        {t('common.lvl')} {currentLevel}/{upgrade.maxLevel}
                    </span>
                    <span className="text-xs font-bold text-neuro-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]">
                        +{formatHashValue(upgrade.basePower)}
                    </span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300 mt-2 mb-4 leading-relaxed max-w-[95%] min-h-[2.5em]">
            {upgrade.description[language]}
          </p>

          {isMaxed ? (
             <button disabled className="w-full py-3 rounded-xl font-bold font-mono text-xs tracking-wider bg-white/5 border border-white/10 text-slate-500 flex items-center justify-center gap-2 cursor-not-allowed">
                 <Lock size={12} /> {t('shop.locked')}
             </button>
          ) : (
             <div className="flex gap-3 mt-2 relative z-20">
                 {upgrade.costTon > 0 && (
                     <PurchaseButton currency="TON" amount={costTon} disabled={!canAffordTon} onClick={() => onPurchase(upgrade.id, 'TON')} fullWidth={upgrade.costNrc <= 0} />
                 )}
                 {upgrade.costNrc > 0 && (
                     <PurchaseButton currency="NRC" amount={costNrc} disabled={!canAffordNrc} onClick={() => onPurchase(upgrade.id, 'NRC')} fullWidth={upgrade.costTon <= 0} />
                 )}
             </div>
          )}
        </div>
      );
  };

  const renderMarketTab = () => {
      const isPremium = playerState.premiumUntil > Date.now();
      const premiumUpgrades = UPGRADES.filter(u => u.category === 'premium');
      const limitedUpgrade = UPGRADES.find(u => u.category === 'limited');

      // Limited Stock
      let stockRemaining = 0;
      let isSoldOut = false;
      if (limitedUpgrade) {
          const sold = GameService.getLimitedStock(limitedUpgrade.id);
          stockRemaining = (limitedUpgrade.globalLimit || 0) - sold;
          if (stockRemaining <= 0) isSoldOut = true;
      }

      return (
          <div className="flex flex-col gap-4">
              
              {/* BLOCK 1: PREMIUM */}
              <div className={`
                 rounded-2xl p-6 relative overflow-hidden border transition-all duration-300
                 ${isPremium 
                    ? 'bg-neuro-gold/10 border-neuro-gold shadow-[0_0_30px_rgba(255,184,0,0.2)]' 
                    : 'glass-card border-neuro-gold/30 shadow-[0_0_15px_rgba(255,184,0,0.1)]'}
              `}>
                 {/* Background Shine */}
                 <div className="absolute -top-10 -right-10 w-32 h-32 bg-neuro-gold/20 blur-[50px] rounded-full pointer-events-none"></div>

                 <div className="flex items-center gap-4 mb-4 relative z-10">
                     <div className="w-14 h-14 rounded-full bg-neuro-gold/20 border border-neuro-gold/50 flex items-center justify-center shadow-glow">
                         <Crown size={28} className="text-neuro-gold fill-neuro-gold/20" />
                     </div>
                     <div>
                         <h3 className="text-xl font-bold text-white uppercase tracking-wide">{t('shop.premium_title')}</h3>
                         <p className="text-xs text-neuro-gold/80 font-bold">{t('shop.premium_desc')}</p>
                     </div>
                 </div>

                 {isPremium ? (
                     /* ACTIVE COUNTER STATE */
                     <div className="flex flex-col items-center justify-center bg-black/40 rounded-xl p-4 border border-neuro-gold/30 relative z-20">
                         <span className="text-[10px] text-neuro-gold uppercase tracking-[0.2em] font-bold mb-1">{t('shop.expires_in')}</span>
                         <div className="text-3xl font-mono font-bold text-white flex items-center gap-2">
                             <Timer className="text-neuro-gold animate-pulse-slow"/> {timeLeft}
                         </div>
                         <div className="mt-2 text-xs text-slate-400 font-mono text-center">{t('shop.benefit_active')}</div>
                     </div>
                 ) : (
                     /* PURCHASE BUTTONS STATE */
                     <div className="grid grid-cols-3 gap-2 mt-4 relative z-20">
                         {premiumUpgrades.map(p => (
                             <button
                                key={p.id}
                                type="button"
                                onClick={() => onPurchase(p.id, 'TON')}
                                className="group relative flex flex-col items-center gap-1 bg-black/40 border border-neuro-gold/30 rounded-xl p-2 py-3 hover:bg-neuro-gold/20 hover:border-neuro-gold active:scale-95 transition-all cursor-pointer z-20"
                             >
                                 <span className="text-[10px] font-bold text-slate-300 uppercase">{p.name[language].split('(')[1].replace(')', '')}</span>
                                 <span className="text-lg font-mono font-bold text-white group-hover:text-neuro-gold">{p.costTon} TON</span>
                             </button>
                         ))}
                     </div>
                 )}
              </div>

              {/* BLOCK 2: LIMITED SUPER COMPUTER */}
              {limitedUpgrade && (
                  <div className="glass-card rounded-2xl p-0 overflow-hidden border border-neuro-cyan/50 shadow-[0_0_20px_rgba(0,240,255,0.15)] relative">
                      {/* Limited Badge */}
                      <div className="absolute top-0 right-0 bg-neuro-cyan text-black text-[10px] font-bold px-3 py-1 rounded-bl-xl z-20">
                          {t('shop.limited')}
                      </div>

                      <div className="p-5 relative z-10">
                          <div className="flex items-center gap-4 mb-2">
                              <div className="w-14 h-14 rounded-xl bg-neuro-cyan/10 border border-neuro-cyan text-neuro-cyan flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.2)]">
                                  <Atom size={28} />
                              </div>
                              <div>
                                  <h3 className="text-lg font-bold text-white leading-none mb-1">{limitedUpgrade.name[language]}</h3>
                                  <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-neuro-cyan bg-neuro-cyan/10 px-2 py-0.5 rounded border border-neuro-cyan/20">
                                          {formatHashValue(limitedUpgrade.basePower)}
                                      </span>
                                  </div>
                              </div>
                          </div>

                          <p className="text-xs text-slate-300 mb-4">{limitedUpgrade.description[language]}</p>

                          {/* Progress Bar */}
                          <div className="bg-black/40 rounded-lg p-2 mb-4 border border-white/5">
                              <div className="flex justify-between text-[9px] font-bold uppercase mb-1">
                                  <span className="text-neuro-cyan">{t('shop.global_stock')}</span>
                                  <span className="text-white">{stockRemaining} / {limitedUpgrade.globalLimit}</span>
                              </div>
                              <div className="h-2 w-full bg-black rounded-full overflow-hidden border border-white/10">
                                  <div 
                                    className="h-full bg-neuro-cyan shadow-[0_0_10px_#00F0FF]" 
                                    style={{ width: `${(stockRemaining / (limitedUpgrade.globalLimit || 1)) * 100}%` }}
                                  ></div>
                              </div>
                          </div>

                          {/* Purchase Button */}
                          <div className="relative z-20">
                            {isSoldOut ? (
                                <button disabled className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-slate-500 font-bold font-mono text-sm flex items-center justify-center gap-2 cursor-not-allowed">
                                    <Lock size={14} /> {t('shop.sold_out')}
                                </button>
                            ) : (
                                <PurchaseButton 
                                    currency="TON" 
                                    amount={limitedUpgrade.costTon} 
                                    disabled={false} 
                                    onClick={() => onPurchase(limitedUpgrade.id, 'TON')} 
                                    fullWidth={true} 
                                />
                            )}
                          </div>
                      </div>
                  </div>
              )}

          </div>
      );
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn p-4 pb-32">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-sans font-bold text-white flex items-center gap-2">
            <ShoppingBag className="text-neuro-cyan" /> 
            <span className="gradient-text">{t('shop.title')}</span>
        </h2>
        <p className="text-slate-400 text-sm">{t('shop.subtitle')}</p>
      </div>

      {/* 4 TABS */}
      <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 z-20 relative">
        {(['clicker', 'miners', 'farms', 'market'] as ShopTab[]).map((tab) => (
            <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === tab ? 'bg-neuro-violet text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
                {t(`shop.tabs.${tab}`)}
            </button>
        ))}
      </div>

      <div className="grid gap-4">
          {activeTab === 'market' 
            ? renderMarketTab() 
            : filterUpgrades(activeTab).map(renderStandardCard)
          }
      </div>
    </div>
  );
};

export default Shop;