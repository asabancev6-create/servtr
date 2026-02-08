
import React, { useState, useEffect, useRef } from 'react';
import { PlayerState, GlobalStats, Tab } from './types';
import { GameService } from './services/mockBackend';
import { INITIAL_STATE } from './constants';
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
  
  // Initial Global Stats Placeholder
  const [globalStats, setGlobalStats] = useState<GlobalStats>(GameService.getGlobalStats(0));
  
  // Buffer for local mining to show smooth numbers before server sync
  const localHashBuffer = useRef(0);

  // --- INIT & SYNC LOOP ---
  useEffect(() => {
    const init = async () => {
        const state = await GameService.loadState();
        setPlayerState(state);
        
        const global = await GameService.fetchGlobal();
        if(global) setGlobalStats(global);
    };
    init();

    // 1. GLOBAL SYNC LOOP (Every 2s)
    const syncInterval = setInterval(async () => {
        const global = await GameService.fetchGlobal();
        if(global) setGlobalStats(global);
        
        // Also grab latest user state from background flush
        const serverState = GameService.getLastState();
        if(serverState && serverState.lastSaveTime !== playerState.lastSaveTime) {
            // Reconcile: If server has newer data, update, but keep local hash buffer visual?
            // Simplified: Just set state.
            setPlayerState(prev => ({
                ...serverState,
                // Optional: add local buffer to balance for smoothness? No, strict sync is safer.
            }));
        }
    }, 2000);

    return () => clearInterval(syncInterval);
  }, []);

  // --- MINING LOOP (Submit Hashes) ---
  useEffect(() => {
    const mineInterval = setInterval(() => {
        if(playerState.autoMineRate > 0) {
            // Accumulate locally
            const amount = playerState.autoMineRate / 5; // 200ms tick
            GameService.submitHashes(amount, playerState); // Pushes to service buffer
            
            // Visual update only
            setPlayerState(prev => ({
                ...prev,
                // balance: prev.balance + (amount / globalStats.currentDifficulty) * 50 // Rough calc?
            }));
        }
    }, 200);
    return () => clearInterval(mineInterval);
  }, [playerState.autoMineRate]);


  // Actions
  const handleMine = () => {
    // Manual Tap
    const amount = playerState.clickPower;
    GameService.submitHashes(amount, playerState);
    if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
  };

  const handleStateUpdate = (newState: PlayerState) => {
      setPlayerState(newState);
  };

  const handlePurchase = async (id: string, currency: 'TON' | 'NRC' = 'TON') => {
    const result = await GameService.purchaseUpgrade(playerState, id, currency);
    
    if (result.success && result.newState) {
      handleStateUpdate(result.newState);
      if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    } else {
       if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      if (result.message) alert(result.message);
    }
  };
  
  const handleExchange = async (amount: number, type: 'buy' | 'sell') => {
      const result = await GameService.exchangeCurrency(playerState, amount, type);
      
      if (result.success && result.newState) {
          handleStateUpdate(result.newState);
          if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      } else {
          if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
          alert(`Exchange Failed: ${result.message}`);
      }
  };

  const handleWalletAction = (type: 'connect' | 'disconnect' | 'add_ton' | 'add_stars', amount?: number) => {
      // Simulation for UI wallet
      setPlayerState(prev => {
          let newState = { ...prev };
          if (type === 'connect') newState.walletAddress = "UQDt...8s3A";
          else if (type === 'disconnect') newState.walletAddress = null;
          else if (type === 'add_ton') newState.tonBalance += (amount || 1);
          
          if(window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          return newState;
      });
  };

  const handleClaimAchievement = async (id: string) => {
      // Not implemented on server yet
      alert("Achievement claim coming in V2");
  };

  const fetchGlobal = async () => {
      const g = await GameService.fetchGlobal();
      if(g) setGlobalStats(g);
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
