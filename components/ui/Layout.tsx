import React, { useState, useEffect } from 'react';
import { Pickaxe, ShoppingBag, Wallet, UserCircle2, Activity, Gem, X, Check, Settings, Star, Copy, LogOut, ArrowDownCircle, ArrowUpCircle, ShieldCheck, Dices, Award, Trophy } from 'lucide-react';
import { Tab, PlayerState, TelegramUser } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { ACHIEVEMENTS, calculateLevel, ADMIN_WALLET_ADDRESS } from '../../constants';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  playerState: PlayerState;
  onWalletAction?: (type: 'connect' | 'disconnect' | 'add_ton', amount?: number) => void;
}

// Icon Mapping for Header Fallback
const iconMap: Record<string, React.ReactNode> = {
  'Pickaxe': <Pickaxe size={12} className="text-neuro-cyan" />,
  'Zap': <div className="text-neuro-cyan"><Settings size={12}/></div>, 
  'Crown': <div className="text-neuro-gold"><Gem size={12}/></div>,
  'Award': <Award size={12} className="text-orange-400" />,
  'Star': <Star size={12} className="text-neuro-cyan" />,
  'Trophy': <Trophy size={12} className="text-neuro-gold" />,
  'Gem': <Gem size={12} className="text-neuro-pink" />,
};

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, playerState, onWalletAction }) => {
  const { t, language, setLanguage } = useLanguage();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(null);
  
  // State for TON Deposit Input
  const [tonDepositAmount, setTonDepositAmount] = useState<string>('');
  
  // Calculate Level dynamically
  const currentLevel = calculateLevel(playerState.lifetimeHashes);

  // --- HIGHEST BADGE LOGIC FOR HEADER ---
  const highestClaimedIndex = ACHIEVEMENTS.reduce((maxIndex, ach, idx) => {
      const record = playerState.achievements[ach.id];
      if (record && record.claimed) {
          return idx > maxIndex ? idx : maxIndex;
      }
      return maxIndex;
  }, -1);
  const highestBadge = highestClaimedIndex > -1 ? ACHIEVEMENTS[highestClaimedIndex] : null;

  useEffect(() => {
    // Initialize Telegram Web App
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // Force dark styling for Telegram UI frame
      try {
        tg.setHeaderColor('#000000');
        tg.setBackgroundColor('#000000');
      } catch (e) {
        console.warn('Error setting TG colors', e);
      }

      // Get User Data
      if (tg.initDataUnsafe?.user) {
        setUser(tg.initDataUnsafe.user);
        // Auto-detect language if available and simple check
        if (tg.initDataUnsafe.user.language_code === 'ru') {
          setLanguage('ru');
        }
      } else {
        // Fallback for development in browser
        setUser({
           id: 12345678,
           first_name: "Pilot",
           username: "crypto_miner",
        });
      }
    }
  }, [setLanguage]);

  const shortenAddress = (addr: string) => {
    return addr.slice(0, 4) + '...' + addr.slice(-4);
  };

  const handleDepositTon = () => {
    const amount = parseFloat(tonDepositAmount);
    if (amount > 0 && onWalletAction) {
        onWalletAction('add_ton', amount);
        setTonDepositAmount(''); // Clear input
    }
  };

  const copyAdminAddress = () => {
      navigator.clipboard.writeText(ADMIN_WALLET_ADDRESS);
      if(window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.selectionChanged();
      }
      alert("Admin Wallet Address Copied!");
  };

  return (
    // Use h-[100dvh] for dynamic viewport height on mobile browsers and TG WebApp
    <div className="flex flex-col h-[100dvh] w-full bg-neuro-bg text-white relative font-sans overflow-hidden selection:bg-neuro-cyan/30">
      
      {/* Background Orbs - Global */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-[radial-gradient(circle,_#8D73FF_0%,_transparent_70%)] opacity-20 blur-[100px] animate-float"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[radial-gradient(circle,_#00F0FF_0%,_transparent_70%)] opacity-20 blur-[100px] animate-float" style={{ animationDelay: '5s' }}></div>
        <div className="absolute top-[40%] left-[30%] w-[50%] h-[50%] bg-[radial-gradient(circle,_#FF00E5_0%,_transparent_70%)] opacity-10 blur-[80px] animate-float" style={{ animationDelay: '10s' }}></div>
      </div>

      {/* FLOATING HUD HEADER */}
      <header className="absolute top-0 left-0 w-full z-50 px-3 pt-4 pb-2 flex justify-between items-center pointer-events-none">
        
        {/* LEFT: EXPANDED COMMAND HUB (Profile + Settings) */}
        <div className="pointer-events-auto flex items-center bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-full p-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.5)] gap-3 pr-2 transition-transform active:scale-[0.98]">
            
            {/* Clickable Profile Area */}
            <button 
                onClick={() => onTabChange(Tab.PROFILE)}
                className="flex items-center gap-3 group pl-0.5"
            >
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-neuro-gradient-primary p-[1.5px] shadow-[0_0_12px_rgba(141,115,255,0.6)] group-hover:shadow-[0_0_20px_rgba(0,240,255,0.8)] transition-all duration-300">
                    {user?.photo_url ? (
                        <img src={user.photo_url} alt="Profile" className="w-full h-full rounded-full bg-black object-cover" />
                    ) : (
                        <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                            <UserCircle2 size={20} className="text-white" />
                        </div>
                    )}
                    </div>
                    {/* Online Status Dot */}
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#00ff41] border-[2px] border-[#0a0a0a] rounded-full shadow-[0_0_6px_#00ff41]"></div>
                </div>
                
                <div className="flex flex-col items-start mr-1">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-bold text-white leading-none max-w-[90px] truncate mb-1 tracking-wide">
                            {user?.first_name || 'Pilot'}
                        </span>
                        {/* HEADER BADGE */}
                        {highestBadge && (
                            <div className="w-4 h-4 rounded-full flex items-center justify-center overflow-hidden bg-white/10 border border-white/20">
                                {highestBadge.imageUrl ? (
                                    <img src={highestBadge.imageUrl} alt="Badge" className="w-full h-full object-contain p-[1px]" />
                                ) : (
                                    iconMap[highestBadge.icon]
                                )}
                            </div>
                        )}
                    </div>
                    <span className="text-[10px] font-mono font-bold text-neuro-cyan/90 flex items-center gap-1.5 bg-neuro-cyan/10 px-1.5 py-[1px] rounded-[4px]">
                        {t('common.lvl')} {currentLevel} 
                    </span>
                </div>
            </button>

            {/* Vertical Divider */}
            <div className="w-[1px] h-6 bg-white/10 mx-0.5"></div>

            {/* Integrated Settings Button */}
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    setIsSettingsOpen(true);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
                <Settings size={18} />
            </button>
        </div>
        
        {/* RIGHT: WALLET BUTTON */}
        <button 
            onClick={() => setIsWalletOpen(true)}
            className={`pointer-events-auto flex items-center gap-2 backdrop-blur-xl border rounded-full px-3 py-1.5 shadow-lg active:scale-95 transition-transform group ${playerState.walletAddress ? 'bg-[#0098EA]/20 border-[#0098EA]/50' : 'bg-[#0a0a0a]/80 border-white/10'}`}
        >
             {playerState.walletAddress ? (
                 <>
                    <div className="w-5 h-5 rounded-full bg-[#0098EA] flex items-center justify-center shadow-[0_0_8px_rgba(0,152,234,0.6)]">
                        <Wallet size={12} className="text-white" />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-white">
                        {playerState.tonBalance > 0 ? playerState.tonBalance.toFixed(2) : '0.00'} TON
                    </span>
                 </>
             ) : (
                 <>
                    <Wallet size={16} className="text-white" />
                    <span className="text-[10px] font-bold text-white uppercase">{t('wallet.connect')}</span>
                 </>
             )}
        </button>

      </header>

      {/* Main Content Area - Padding top adjusted for floating header */}
      <main className="flex-1 overflow-y-auto z-10 custom-scrollbar overscroll-contain pt-24">
        {children}
      </main>

      {/* Bottom Navigation */}
      {activeTab !== Tab.ADMIN && (
          <nav className="fixed bottom-0 left-0 w-full z-40 bg-black/80 backdrop-blur-xl border-t border-white/5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 px-2">
            {/* Decorative top line gradient */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-neuro-violet/50 to-transparent"></div>

            <div className="flex justify-around items-center max-w-lg mx-auto">
            
            <NavButton 
                active={activeTab === Tab.MINER} 
                onClick={() => {
                    if(window.Telegram?.WebApp?.HapticFeedback) {
                        window.Telegram.WebApp.HapticFeedback.selectionChanged();
                    }
                    onTabChange(Tab.MINER)
                }} 
                icon={<Pickaxe size={22} />} 
                label={t('tabs.mine')} 
            />
            
            {/* Market / Shop */}
            <NavButton 
                active={activeTab === Tab.SHOP} 
                onClick={() => {
                    if(window.Telegram?.WebApp?.HapticFeedback) {
                        window.Telegram.WebApp.HapticFeedback.selectionChanged();
                    }
                    onTabChange(Tab.SHOP)
                }} 
                icon={<ShoppingBag size={22} />} 
                label={t('tabs.shop')} 
            />

            {/* Games / Casino - NEW */}
            <NavButton 
                active={activeTab === Tab.GAMES} 
                onClick={() => {
                    if(window.Telegram?.WebApp?.HapticFeedback) {
                        window.Telegram.WebApp.HapticFeedback.selectionChanged();
                    }
                    onTabChange(Tab.GAMES)
                }} 
                icon={<Dices size={22} />} 
                label={t('tabs.games')} 
            />

            {/* Collections */}
            <NavButton 
                active={activeTab === Tab.COLLECTIONS} 
                onClick={() => {
                    if(window.Telegram?.WebApp?.HapticFeedback) {
                        window.Telegram.WebApp.HapticFeedback.selectionChanged();
                    }
                    onTabChange(Tab.COLLECTIONS)
                }} 
                icon={<Gem size={22} />} 
                label={t('tabs.coll')} 
            />

            {/* Network / Investments */}
            <NavButton 
                active={activeTab === Tab.INVEST} 
                onClick={() => {
                    if(window.Telegram?.WebApp?.HapticFeedback) {
                        window.Telegram.WebApp.HapticFeedback.selectionChanged();
                    }
                    onTabChange(Tab.INVEST)
                }} 
                icon={<Activity size={22} />} 
                label={t('tabs.invest')} 
            />

            </div>
        </nav>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setIsSettingsOpen(false)}></div>
          <div className="glass-card w-full max-w-xs rounded-3xl p-6 relative z-10 animate-scaleIn border border-neuro-violet/30 shadow-glow-strong bg-[#050505]">
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-2"
            >
              <X size={24} />
            </button>
            
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Settings className="text-neuro-cyan"/> {t('profile.settings')}
            </h3>

            <div className="space-y-3">
              <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-2 font-bold">{t('profile.language')}</p>
              
              <button 
                onClick={() => { setLanguage('ru'); setIsSettingsOpen(false); }}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all active:scale-95 ${language === 'ru' ? 'bg-neuro-violet/20 border-neuro-violet shadow-[0_0_15px_rgba(141,115,255,0.2)]' : 'bg-white/5 border-white/10'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇷🇺</span>
                  <span className="font-bold text-white">Русский</span>
                </div>
                {language === 'ru' && <Check size={20} className="text-neuro-cyan" />}
              </button>

              <button 
                onClick={() => { setLanguage('en'); setIsSettingsOpen(false); }}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all active:scale-95 ${language === 'en' ? 'bg-neuro-violet/20 border-neuro-violet shadow-[0_0_15px_rgba(141,115,255,0.2)]' : 'bg-white/5 border-white/10'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇺🇸</span>
                  <span className="font-bold text-white">English</span>
                </div>
                {language === 'en' && <Check size={20} className="text-neuro-cyan" />}
              </button>

              {/* ADMIN ACCESS BUTTON */}
              <button 
                onClick={() => { onTabChange(Tab.ADMIN); setIsSettingsOpen(false); }}
                className="w-full mt-4 flex items-center justify-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/20 font-bold text-xs uppercase tracking-widest transition-all"
              >
                 <ShieldCheck size={14} /> {t('profile.admin_access')}
              </button>

            </div>
          </div>
        </div>
      )}

      {/* WALLET MODAL */}
      {isWalletOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-fadeIn" onClick={() => setIsWalletOpen(false)}></div>
            <div className="glass-card w-full max-w-sm rounded-[32px] p-6 relative z-10 animate-slideUp border border-neuro-cyan/20 shadow-[0_0_50px_rgba(0,240,255,0.15)] bg-[#050505]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Wallet className="text-neuro-cyan"/> {t('wallet.title')}
                    </h3>
                    <button 
                        onClick={() => setIsWalletOpen(false)}
                        className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Connection State */}
                {!playerState.walletAddress ? (
                    <div className="bg-gradient-to-br from-[#0098EA]/20 to-transparent p-6 rounded-2xl border border-[#0098EA]/30 text-center mb-6">
                         <div className="w-16 h-16 rounded-full bg-[#0098EA] mx-auto mb-4 flex items-center justify-center shadow-[0_0_20px_rgba(0,152,234,0.5)]">
                            <Wallet size={32} className="text-white" />
                         </div>
                         <h4 className="font-bold text-white mb-2">{t('wallet.connect')}</h4>
                         <p className="text-xs text-[#0098EA] mb-4 opacity-80">{t('wallet.connect_desc')}</p>
                         <button 
                            onClick={() => onWalletAction && onWalletAction('connect')}
                            className="w-full py-3 bg-[#0098EA] rounded-xl font-bold text-white shadow-lg hover:bg-[#0086cf] transition-all active:scale-95 flex items-center justify-center gap-2"
                         >
                            TON Connect <ArrowUpCircle size={16} className="rotate-45"/>
                         </button>
                    </div>
                ) : (
                    <div className="bg-[#0098EA]/10 p-4 rounded-2xl border border-[#0098EA]/30 mb-6 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#0098EA] flex items-center justify-center">
                                <Wallet size={20} className="text-white" />
                            </div>
                            <div>
                                <div className="text-[10px] text-[#0098EA] uppercase font-bold tracking-wider">{t('wallet.connected')}</div>
                                <div className="font-mono font-bold text-white flex items-center gap-2">
                                    {shortenAddress(playerState.walletAddress)} 
                                    <Copy size={12} className="text-slate-400 cursor-pointer hover:text-white"/>
                                </div>
                            </div>
                         </div>
                         <button 
                             onClick={() => onWalletAction && onWalletAction('disconnect')}
                             className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                         >
                             <LogOut size={16} />
                         </button>
                    </div>
                )}

                {/* TON Card - Full Width */}
                <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-white/5 flex flex-col items-center text-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-[#0098EA] blur-[40px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                    <div className="w-10 h-10 rounded-full bg-[#0098EA]/10 flex items-center justify-center mb-2">
                            <Wallet size={20} className="text-[#0098EA]" />
                    </div>
                    <div className="text-xs text-slate-400 font-bold uppercase mb-1">{t('wallet.ton')}</div>
                    <div className="text-lg font-mono font-bold text-white mb-2">{playerState.tonBalance.toFixed(2)}</div>
                    
                    {/* DEPOSIT SECTION (SIMULATION) */}
                    <div className="w-full flex flex-col gap-1 mb-2">
                            <div className="text-[9px] text-slate-500 uppercase font-bold text-left w-full pl-1">Address:</div>
                            <button 
                            onClick={copyAdminAddress}
                            className="w-full bg-black/40 border border-white/10 rounded-md text-[10px] font-mono text-center text-neuro-cyan py-1 flex items-center justify-center gap-1 hover:bg-white/5 truncate"
                            >
                                {shortenAddress(ADMIN_WALLET_ADDRESS)} <Copy size={10}/>
                            </button>
                            <input 
                            type="number" 
                            placeholder="Amount"
                            value={tonDepositAmount}
                            onChange={(e) => setTonDepositAmount(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-md text-xs font-mono text-center text-white py-1 outline-none focus:border-[#0098EA] mt-1"
                            />
                    </div>

                    <button 
                            onClick={handleDepositTon}
                            className={`w-full py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-colors
                            ${parseFloat(tonDepositAmount) > 0 
                                ? 'bg-[#0098EA]/20 text-[#0098EA] border-[#0098EA]/30 hover:bg-[#0098EA]/30' 
                                : 'bg-white/5 text-slate-500 border-white/5 cursor-not-allowed'}
                            `}
                    >
                        <ArrowDownCircle size={14} /> Check TX
                    </button>
                </div>

            </div>
        </div>
      )}

    </div>
  );
};

// Helper for Nav Buttons
const NavButton: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string}> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 p-2 min-w-[50px] transition-all duration-300 relative rounded-2xl ${active ? 'bg-white/5' : 'opacity-50 hover:opacity-100'}`}
  >
    <div className={`${active ? 'text-neuro-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]' : 'text-slate-400'}`}>
      {icon}
    </div>
    <span className={`text-[9px] font-bold tracking-wider font-mono ${active ? 'gradient-text' : 'text-slate-500'}`}>
      {label}
    </span>
    {active && (
       <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-neuro-cyan rounded-full shadow-[0_0_5px_#00F0FF]"></div>
    )}
  </button>
);

export default Layout;