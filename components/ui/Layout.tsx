
import React, { useState, useEffect } from 'react';
import { Pickaxe, ShoppingBag, Wallet, UserCircle2, Activity, Gem, X, Check, Settings, Star, Copy, LogOut, ArrowDownCircle, ArrowUpCircle, ShieldCheck, Dices } from 'lucide-react';
import { Tab, PlayerState, TelegramUser } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { ACHIEVEMENTS, calculateLevel } from '../../constants';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  playerState: PlayerState;
  onWalletAction?: (type: 'connect' | 'disconnect' | 'add_ton' | 'add_stars', amount?: number) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, playerState, onWalletAction }) => {
  const { t, language, setLanguage } = useLanguage();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [tonDepositAmount, setTonDepositAmount] = useState<string>('');
  
  const currentLevel = calculateLevel(playerState.lifetimeHashes);

  useEffect(() => {
    // Initialize Telegram Web App
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      
      // FULL SCREEN & COLORS
      try {
          tg.expand();
          tg.setHeaderColor('#000000');
          tg.setBackgroundColor('#000000');
          // For iOS swipe-to-close behavior handling if needed
          tg.enableClosingConfirmation(); 
      } catch (e) {
          console.warn('Telegram API Error', e);
      }

      if (tg.initDataUnsafe?.user) {
        setUser(tg.initDataUnsafe.user);
        if (tg.initDataUnsafe.user.language_code === 'ru') {
          setLanguage('ru');
        }
      }
    }
  }, [setLanguage]);

  const shortenAddress = (addr: string) => addr.slice(0, 4) + '...' + addr.slice(-4);

  const handleDepositTon = () => {
      // Stub for TON Connect Transaction
      const amount = parseFloat(tonDepositAmount);
      if (amount > 0 && onWalletAction) {
          onWalletAction('add_ton', amount);
          setTonDepositAmount('');
      }
  };

  return (
    // Use h-[100dvh] for dynamic viewport height
    <div className="flex flex-col h-[100dvh] w-full bg-neuro-bg text-white relative font-sans overflow-hidden selection:bg-neuro-cyan/30">
      
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-[radial-gradient(circle,_#8D73FF_0%,_transparent_70%)] opacity-20 blur-[100px] animate-float"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[radial-gradient(circle,_#00F0FF_0%,_transparent_70%)] opacity-20 blur-[100px] animate-float" style={{ animationDelay: '5s' }}></div>
      </div>

      {/* FLOATING HUD HEADER - Adjusted for Safe Area */}
      <header className="absolute top-0 left-0 w-full z-50 px-3 pt-[calc(env(safe-area-inset-top)+12px)] pb-2 flex justify-between items-center pointer-events-none">
        
        {/* LEFT: COMMAND HUB */}
        <div className="pointer-events-auto flex items-center bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-full p-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.5)] gap-3 pr-2 transition-transform active:scale-[0.98]">
            <button onClick={() => onTabChange(Tab.PROFILE)} className="flex items-center gap-3 group pl-0.5">
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-neuro-gradient-primary p-[1.5px] shadow-[0_0_12px_rgba(141,115,255,0.6)]">
                    {user?.photo_url ? (
                        <img src={user.photo_url} alt="Profile" className="w-full h-full rounded-full bg-black object-cover" />
                    ) : (
                        <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                            <UserCircle2 size={20} className="text-white" />
                        </div>
                    )}
                    </div>
                </div>
                
                <div className="flex flex-col items-start mr-1">
                    <span className="text-[13px] font-bold text-white leading-none max-w-[90px] truncate mb-1 tracking-wide">
                        {user?.first_name || 'Pilot'}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-neuro-cyan/90 flex items-center gap-1.5 bg-neuro-cyan/10 px-1.5 py-[1px] rounded-[4px]">
                        {t('common.lvl')} {currentLevel} 
                    </span>
                </div>
            </button>
            <div className="w-[1px] h-6 bg-white/10 mx-0.5"></div>
            <button onClick={() => setIsSettingsOpen(true)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <Settings size={18} />
            </button>
        </div>
        
        {/* RIGHT: WALLET PILL */}
        <button onClick={() => setIsWalletOpen(true)} className="pointer-events-auto flex items-center gap-2 bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-full px-2 py-1.5 shadow-lg active:scale-95 transition-transform group hover:border-neuro-cyan/30">
             <div className="flex items-center gap-1.5 pl-1">
                <div className="w-5 h-5 rounded-full bg-[#0098EA] flex items-center justify-center shadow-[0_0_8px_rgba(0,152,234,0.6)]">
                    <Wallet size={12} className="text-white" />
                </div>
                <span className="text-[11px] font-mono font-bold text-white">
                    {playerState.tonBalance > 0 ? playerState.tonBalance.toFixed(2) : '0.00'}
                </span>
             </div>
             <div className="w-[1px] h-4 bg-white/10"></div>
             <div className="flex items-center gap-1.5 pr-1">
                <Star size={14} className="text-[#FFB800] fill-[#FFB800]" />
                <span className="text-[11px] font-mono font-bold text-white">
                    {playerState.starsBalance.toLocaleString()}
                </span>
             </div>
        </button>
      </header>

      {/* MAIN CONTENT - Adjusted Top Padding */}
      <main className="flex-1 overflow-y-auto z-10 custom-scrollbar overscroll-contain pt-[calc(env(safe-area-inset-top)+88px)]">
        {children}
      </main>

      {/* BOTTOM NAV - Adjusted Bottom Padding */}
      {activeTab !== Tab.ADMIN && (
          <nav className="fixed bottom-0 left-0 w-full z-40 bg-black/80 backdrop-blur-xl border-t border-white/5 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 px-2">
            <div className="flex justify-around items-center max-w-lg mx-auto">
                <NavButton active={activeTab === Tab.MINER} onClick={() => onTabChange(Tab.MINER)} icon={<Pickaxe size={22} />} label={t('tabs.mine')} />
                <NavButton active={activeTab === Tab.SHOP} onClick={() => onTabChange(Tab.SHOP)} icon={<ShoppingBag size={22} />} label={t('tabs.shop')} />
                <NavButton active={activeTab === Tab.GAMES} onClick={() => onTabChange(Tab.GAMES)} icon={<Dices size={22} />} label={t('tabs.games')} />
                <NavButton active={activeTab === Tab.COLLECTIONS} onClick={() => onTabChange(Tab.COLLECTIONS)} icon={<Gem size={22} />} label={t('tabs.coll')} />
                <NavButton active={activeTab === Tab.INVEST} onClick={() => onTabChange(Tab.INVEST)} icon={<Activity size={22} />} label={t('tabs.invest')} />
            </div>
        </nav>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}></div>
          <div className="glass-card w-full max-w-xs rounded-3xl p-6 relative z-10 border border-neuro-violet/30 bg-[#050505]">
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 text-slate-400 p-2"><X size={24} /></button>
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Settings className="text-neuro-cyan"/> {t('profile.settings')}</h3>
            <div className="space-y-3">
              <button onClick={() => { setLanguage('ru'); setIsSettingsOpen(false); }} className={`w-full flex items-center justify-between p-4 rounded-xl border ${language === 'ru' ? 'bg-neuro-violet/20 border-neuro-violet' : 'bg-white/5 border-white/10'}`}>
                <span className="font-bold text-white">Русский 🇷🇺</span>
                {language === 'ru' && <Check size={20} className="text-neuro-cyan" />}
              </button>
              <button onClick={() => { setLanguage('en'); setIsSettingsOpen(false); }} className={`w-full flex items-center justify-between p-4 rounded-xl border ${language === 'en' ? 'bg-neuro-violet/20 border-neuro-violet' : 'bg-white/5 border-white/10'}`}>
                <span className="font-bold text-white">English 🇺🇸</span>
                {language === 'en' && <Check size={20} className="text-neuro-cyan" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WALLET MODAL */}
      {isWalletOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsWalletOpen(false)}></div>
            <div className="glass-card w-full max-w-sm rounded-[32px] p-6 relative z-10 border border-neuro-cyan/20 bg-[#050505]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><Wallet className="text-neuro-cyan"/> {t('wallet.title')}</h3>
                    <button onClick={() => setIsWalletOpen(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400"><X size={18} /></button>
                </div>
                
                {/* TON DEPOSIT */}
                <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-white/5 flex flex-col items-center text-center mb-4">
                    <div className="text-xs text-slate-400 font-bold uppercase mb-1">{t('wallet.ton')}</div>
                    <div className="text-lg font-mono font-bold text-white mb-2">{playerState.tonBalance.toFixed(2)}</div>
                    <div className="w-full flex gap-1 mb-2">
                         <input type="number" placeholder="0.0" value={tonDepositAmount} onChange={(e) => setTonDepositAmount(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-md text-xs font-mono text-center text-white py-1 outline-none focus:border-[#0098EA]" />
                    </div>
                    <button onClick={handleDepositTon} className={`w-full py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 ${parseFloat(tonDepositAmount) > 0 ? 'bg-[#0098EA]/20 text-[#0098EA] border-[#0098EA]/30' : 'bg-white/5 text-slate-500 border-white/5'}`}>
                        <ArrowDownCircle size={14} /> {t('wallet.deposit')}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const NavButton: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string}> = ({ active, onClick, icon, label }) => (
  <button onClick={() => { if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.selectionChanged(); onClick(); }} className={`flex flex-col items-center gap-1 p-2 min-w-[50px] transition-all duration-300 relative rounded-2xl ${active ? 'bg-white/5' : 'opacity-50 hover:opacity-100'}`}>
    <div className={`${active ? 'text-neuro-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]' : 'text-slate-400'}`}>{icon}</div>
    <span className={`text-[9px] font-bold tracking-wider font-mono ${active ? 'gradient-text' : 'text-slate-500'}`}>{label}</span>
    {active && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-neuro-cyan rounded-full shadow-[0_0_5px_#00F0FF]"></div>}
  </button>
);

export default Layout;
