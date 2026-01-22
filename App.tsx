
import React, { useState, useEffect, useRef } from 'react';
import { PlayerState, GlobalStats, Tab } from './types';
import { GameService } from './services/mockBackend'; // Now points to our API Client wrapper
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
  const [globalStats, setGlobalStats] = useState<GlobalStats>(GameService.getGlobalStats(0));
  
  const stateRef = useRef(playerState);
  const globalStatsRef = useRef(globalStats);

  // --- INITIALIZATION ---
  useEffect(() => {
    const initGame = async () => {
        // Try to get Telegram User ID
        let userId = 'guest';
        if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
            userId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
        }

        const data = await GameService.init(userId);
        setPlayerState(data.user);
        stateRef.current = data.user;
        
        setGlobalStats(data.global);
        globalStatsRef.current = data.global;
    };
    
    initGame();
  }, []);

  // --- SYNC LOOP (Background) ---
  useEffect(() => {
      // Sync mining progress to server every 3 seconds
      const syncInterval = setInterval(async () => {
          const syncedData = await GameService.syncWithServer();
          if (syncedData) {
              setPlayerState(syncedData.user);
              stateRef.current = syncedData.user;
              
              setGlobalStats(syncedData.global);
              globalStatsRef.current = syncedData.global;
          }
      }, 3000);

      return () => clearInterval(syncInterval);
  }, []);

  // --- CLIENT MINING LOOP (Visuals + Accumulation) ---
  const processHash = (amount: number, currentState: PlayerState): PlayerState => {
    // Submit hashes to service (which accumulates them)
    const { newPlayerState, blockClosed } = GameService.submitHashes(amount, currentState);
    
    if (blockClosed) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
             window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
    }
    return newPlayerState;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const current = stateRef.current;
      
      if (current.autoMineRate > 0) {
        const hashAmount = current.autoMineRate / 5; // 5 times a second
        const newState = processHash(hashAmount, current); 
        setPlayerState(newState);
        stateRef.current = newState;
      }
    }, 200);

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
    const result = GameService.purchaseUpgrade(stateRef.current, id, currency);
    
    if (result.success && result.newState) {
      handleStateUpdate(result.newState);
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
  
  const handleExchange = (amount: number, type: 'buy' | 'sell') => {
      if (amount <= 0) return;
      const result = GameService.exchangeCurrency(stateRef.current, amount, type);
      
      if (result.success && result.newState) {
          handleStateUpdate(result.newState);
          if(window.Telegram?.WebApp?.HapticFeedback) {
             window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          }
          alert('Exchange Successful');
      } else {
          alert(`Exchange Failed: ${result.message}`);
      }
  };

  const handleWalletAction = (type: 'connect' | 'disconnect' | 'add_ton' | 'add_stars', amount?: number) => {
      setPlayerState(prev => {
          let newState = { ...prev };
          if (type === 'connect') newState.walletAddress = "UQDt...8s3A";
          else if (type === 'disconnect') newState.walletAddress = null;
          else if (type === 'add_ton') newState.tonBalance += (amount || 1.5);
          else if (type === 'add_stars') newState.starsBalance += 250;
          
          stateRef.current = newState;
          return newState;
      });
  };

  const handleClaimAchievement = (id: string) => {
      const result = GameService.claimAchievementReward(stateRef.current, id);
      if (result.success && result.newState) {
          handleStateUpdate(result.newState);
      }
  };

  // Mock refresh needed for components that pull directly
  const fetchGlobal = () => {
      setGlobalStats(GameService.getGlobalStats(stateRef.current.balance));
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
