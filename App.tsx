
import React, { useState, useEffect, useRef } from 'react';
import { PlayerState, GlobalStats, Tab } from './types';
import { GameService } from './services/mockBackend';
import { GLOBAL_REFRESH_RATE, INITIAL_STATE, INITIAL_BLOCK_REWARD, HALVING_INTERVAL, MAX_SUPPLY } from './constants';
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
  
  // Initial Global Stats - Sync immediately
  const [globalStats, setGlobalStats] = useState<GlobalStats>(GameService.getGlobalStats(0));
  
  const stateRef = useRef(playerState);
  const globalStatsRef = useRef(globalStats);

  // Initialize ASYNC to avoid Promise error
  useEffect(() => {
    const init = async () => {
        try {
            const loaded = await GameService.loadState();
            setPlayerState(loaded);
            stateRef.current = loaded;
            
            // Fetch real global stats from server
            const gStats = await GameService.fetchGlobal();
            if (gStats) {
                setGlobalStats(gStats);
                globalStatsRef.current = gStats;
            }
        } catch (e) {
            console.error("Init failed", e);
        }
    };
    init();
  }, []);

  // --- CORE MINING ENGINE (SHARED LEDGER) ---
  const processHash = (amount: number, currentState: PlayerState): PlayerState => {
    // Send hash to backend (simulation) to update Global Chain
    const { newPlayerState, blockClosed } = GameService.submitHashes(amount, currentState);
    
    if (blockClosed) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
             window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        // Force refresh globals
        fetchGlobal();
    }

    return newPlayerState;
  };

  // --- 1. USER AUTO-MINER LOOP ---
  useEffect(() => {
    const interval = setInterval(() => {
      const current = stateRef.current;
      
      // Periodic achievement check (every 3 seconds roughly based on modulo)
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
        // Slower tick for UI performance
        const hashAmount = current.autoMineRate / 5; // 5 times a second
        const newState = processHash(hashAmount, current); 
        setPlayerState(newState);
        stateRef.current = newState;
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  // Global Stats Fetch Loop (Sync with "Network")
  const fetchGlobal = async () => {
    const stats = await GameService.fetchGlobal();
    if (stats) {
        setGlobalStats(stats);
        globalStatsRef.current = stats; 
    }
  };

  useEffect(() => {
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

  const handlePurchase = async (id: string, currency: 'TON' | 'NRC' = 'TON') => {
    const result = await GameService.purchaseUpgrade(stateRef.current, id, currency);
    
    if (result.success && result.newState) {
      handleStateUpdate(result.newState);
      fetchGlobal(); 
      if(window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } else {
       if(window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      }
      if (result.message) alert(result.message);
    }
  };
  
  const handleExchange = async (amount: number, type: 'buy' | 'sell') => {
      if (amount <= 0) return;
      const result = await GameService.exchangeCurrency(stateRef.current, amount, type);
      
      if (result.success && result.newState) {
          handleStateUpdate(result.newState);
          fetchGlobal(); 
          if(window.Telegram?.WebApp?.HapticFeedback) {
             window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          }
          const msg = type === 'sell' 
            ? `Exchange: Sold ${amount} NRC.` 
            : `Exchange: Bought ${amount} NRC.`;
          alert(msg);
      } else {
          if(window.Telegram?.WebApp?.HapticFeedback) {
             window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
          }
          alert(`Exchange Failed: ${result.message}`);
      }
  };

  const handleWalletAction = (type: 'connect' | 'disconnect' | 'add_ton' | 'add_stars', amount?: number) => {
      setPlayerState(prev => {
          let newState = { ...prev };
          if (type === 'connect') {
              newState.walletAddress = "UQDt...8s3A";
              if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          } else if (type === 'disconnect') {
              newState.walletAddress = null;
              if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
          } else if (type === 'add_ton') {
               if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
              const val = amount || 1.5;
              newState.tonBalance += val;
              alert(`Payment simulated: +${val} TON`);
          } else if (type === 'add_stars') {
               if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
              newState.starsBalance += 250;
              alert("Payment simulated: +250 Stars");
          }
          stateRef.current = newState;
          return newState;
      });
  };

  // Claim Achievement
  const handleClaimAchievement = async (id: string) => {
      const result = await GameService.claimAchievementReward(stateRef.current, id);
      if (result.success && result.newState) {
          handleStateUpdate(result.newState);
           if(window.Telegram?.WebApp?.HapticFeedback) {
             window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          }
      }
  };

  const renderContent = () => {
    switch (activeTab) {
      case Tab.MINER:
        return <Miner playerState={playerState} globalStats={globalStats} onMine={handleMine} />;
      case Tab.INVEST:
        return <Investments playerState={playerState} globalStats={globalStats} onPurchase={handlePurchase} />;
      case Tab.SHOP:
        return <Shop playerState={playerState} onPurchase={handlePurchase} />;
      case Tab.GAMES:
        return <Games playerState={playerState} globalStats={globalStats} onUpdate={handleStateUpdate} onRefreshGlobal={fetchGlobal} />;
      case Tab.COLLECTIONS:
        return <Collections playerState={playerState} onUpdate={handleStateUpdate} />;
      case Tab.PROFILE:
        return <Profile playerState={playerState} globalStats={globalStats} onExchange={handleExchange} onClaimAchievement={handleClaimAchievement}/>;
      case Tab.ADMIN:
        return <AdminPanel globalStats={globalStats} onClose={() => setActiveTab(Tab.PROFILE)} onRefresh={fetchGlobal} />;
      default:
        return <Miner playerState={playerState} globalStats={globalStats} onMine={handleMine} />;
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
