import React, { useState, useEffect, useRef } from 'react';
import { PlayerState, GlobalStats, Tab } from './types';
import { GameService } from './services/mockBackend';
import { GLOBAL_REFRESH_RATE, INITIAL_STATE, UPGRADES } from './constants';
import { LanguageProvider } from './contexts/LanguageContext';
import Layout from './components/ui/Layout';
import Miner from './components/Miner';
import Investments from './components/Investments';
import Shop from './components/Shop';
import Collections from './components/Collections';
import Profile from './components/Profile';
import AdminPanel from './components/AdminPanel';
import Games from './components/Games';

const GameContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.MINER);
  const [playerState, setPlayerState] = useState<PlayerState>(INITIAL_STATE);
  const [globalStats, setGlobalStats] = useState<GlobalStats>(GameService.getGlobalStats(0));
  const [loading, setLoading] = useState(true);
  
  const stateRef = useRef(playerState);
  const globalStatsRef = useRef(globalStats);

  // Initialize ASYNC
  useEffect(() => {
    const init = async () => {
        const loaded = await GameService.loadState();
        setPlayerState(loaded);
        stateRef.current = loaded;
        
        const gStats = GameService.getGlobalStats(loaded.balance);
        setGlobalStats(gStats);
        globalStatsRef.current = gStats;
        
        setLoading(false);
    };
    init();
  }, []);

  // --- CORE MINING ENGINE (SHARED LEDGER) ---
  const processHash = (amount: number, currentState: PlayerState): PlayerState => {
    // Send hash to backend via GameService (which now calls API)
    const { newPlayerState, blockClosed } = GameService.submitHashes(amount, currentState);
    
    if (blockClosed) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
             window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        const gStats = GameService.getGlobalStats(newPlayerState.balance);
        setGlobalStats(gStats);
    }

    return newPlayerState;
  };

  // --- 1. USER AUTO-MINER LOOP ---
  useEffect(() => {
    const interval = setInterval(() => {
      const current = stateRef.current;
      
      const now = Date.now();
      if (now % 3000 < 250) {
         const checkedState = GameService.checkAchievements(current);
         if (checkedState !== current) {
             setPlayerState(checkedState);
             stateRef.current = checkedState;
             return;
         }
      }

      if (current.autoMineRate > 0) {
        const hashAmount = current.autoMineRate / 5; 
        const newState = processHash(hashAmount, current); 
        setPlayerState(newState);
        stateRef.current = newState;
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  // Global Stats Fetch Loop
  useEffect(() => {
    const fetchGlobal = () => {
      const stats = GameService.getGlobalStats(stateRef.current.balance);
      setGlobalStats(stats);
      globalStatsRef.current = stats; 
    };
    fetchGlobal();
    const interval = setInterval(fetchGlobal, GLOBAL_REFRESH_RATE);
    return () => clearInterval(interval);
  }, []);

  // Actions
  const handleMine = () => {
    setPlayerState(prev => {
      const newState = processHash(prev.clickPower, prev);
      stateRef.current = newState;
      return newState;
    });
  };

  const handleStateUpdate = (newState: PlayerState) => {
      setPlayerState(newState);
      stateRef.current = newState;
      GameService.saveState(newState); 
  };

  const handlePurchase = (id: string, currency: 'TON' | 'NRC' = 'TON') => {
    if (currency === 'TON') {
        const upgrade = UPGRADES.find(u => u.id === id);
        if (!upgrade) return;
        const currentLevel = stateRef.current.upgrades[id] || 0;
        const cost = upgrade.costTon * Math.pow(1 + upgrade.scaleTon, currentLevel);
        
        if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.selectionChanged();

        const confirm = window.confirm(`Open TON Wallet to pay ${cost.toFixed(2)} TON?`);
        
        if (confirm) {
            setTimeout(() => {
                 const preState = { ...stateRef.current };
                 preState.tonBalance += cost; // Simulating deposit
                 
                 const result = GameService.purchaseUpgrade(preState, id, 'TON');
                 
                 if (result.success && result.newState) {
                    handleStateUpdate(result.newState);
                    if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                    alert("Payment Successful! Item Upgraded.");
                } else {
                    if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
                    if (result.message) alert(result.message);
                }
            }, 1000);
        }
        return;
    }

    const result = GameService.purchaseUpgrade(stateRef.current, id, currency);
    if (result.success && result.newState) {
      handleStateUpdate(result.newState);
      if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
  };
  
  const handleExchange = (amount: number, type: 'buy' | 'sell') => {
      if (amount <= 0) return;
      const result = GameService.exchangeCurrency(stateRef.current, amount, type);
      if (result.success && result.newState) {
          handleStateUpdate(result.newState);
          if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          alert("Exchange Successful");
      } else {
          alert(`Exchange Failed: ${result.message}`);
      }
  };

  const handleWalletAction = (type: 'connect' | 'disconnect' | 'add_ton', amount?: number) => {
      setPlayerState(prev => {
          let newState = { ...prev };
          if (type === 'connect') newState.walletAddress = "UQDt...8s3A"; 
          else if (type === 'disconnect') newState.walletAddress = null;
          else if (type === 'add_ton') {
              const val = amount || 1.5;
              newState.tonBalance += val;
              alert(`Payment simulated: +${val} TON`);
          }
          stateRef.current = newState;
          return newState;
      });
  };

  const handleClaimAchievement = (id: string) => {
      const result = GameService.claimAchievementReward(stateRef.current, id);
      if (result.success && result.newState) handleStateUpdate(result.newState);
  };

  if (loading) {
      return <div className="h-screen w-full bg-black flex items-center justify-center text-neuro-cyan font-mono animate-pulse">CONNECTING TO NEUROCOIN NETWORK...</div>;
  }

  const renderContent = () => {
    switch (activeTab) {
      case Tab.MINER: return <Miner playerState={playerState} globalStats={globalStats} onMine={handleMine} />;
      case Tab.INVEST: return <Investments playerState={playerState} globalStats={globalStats} onPurchase={handlePurchase} />;
      case Tab.SHOP: return <Shop playerState={playerState} onPurchase={handlePurchase} />;
      case Tab.GAMES: return <Games playerState={playerState} globalStats={globalStats} onUpdate={handleStateUpdate} onRefreshGlobal={() => {}} />;
      case Tab.COLLECTIONS: return <Collections playerState={playerState} onUpdate={handleStateUpdate} />;
      case Tab.PROFILE: return <Profile playerState={playerState} globalStats={globalStats} onExchange={handleExchange} onClaimAchievement={handleClaimAchievement}/>;
      case Tab.ADMIN: return <AdminPanel globalStats={globalStats} onClose={() => setActiveTab(Tab.PROFILE)} onRefresh={() => {}} />;
      default: return <Miner playerState={playerState} globalStats={globalStats} onMine={handleMine} />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab} playerState={playerState} onWalletAction={handleWalletAction}>
      {renderContent()}
    </Layout>
  );
}

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <GameContent />
    </LanguageProvider>
  );
};

export default App;