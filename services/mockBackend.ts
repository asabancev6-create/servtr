

import { PlayerState, GlobalStats, Quest, ExchangeConfig, RewardConfig } from '../types';
import { INITIAL_STATE } from '../constants';

const API_URL = '/api'; // Relative path for production integration

class ApiService {
  private hashBuffer: number = 0;
  private syncInterval: NodeJS.Timeout | null = null;
  private lastKnownState: PlayerState = INITIAL_STATE;

  constructor() {
    // Auto-flush buffer every 3s
    this.syncInterval = setInterval(() => this.flushBuffer(), 3000);
  }

  // --- API HELPER ---
  private async request(endpoint: string, method: string = 'GET', body?: any) {
    const initData = window.Telegram?.WebApp?.initData || '';
    const headers: any = {
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData
    };

    // Dev fallback if no TG data
    if (!initData) {
        // Mock user ID for dev
        body = { ...body, userId: 12345678 }; 
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  // --- PUBLIC METHODS ---

  async loadState(): Promise<PlayerState> {
    const res = await this.request('/init', 'POST');
    if (res && res.user) {
        this.lastKnownState = res.user;
        return res.user;
    }
    return INITIAL_STATE;
  }

  getGlobalStats(balance: number): GlobalStats {
    // This is now slightly async in reality, but for initial render we might return empty or last fetched
    // We will use sync() to get real stats.
    // For now, return a placeholder structure that will be filled by loadState/sync
    return {
        totalUsers: 0, totalMined: 0, activeMiners: 0, blockHeight: 0, currentDifficulty: 36000,
        currentBlockHash: 0, lastBlockTime: 0, epochStartTime: 0, marketCap: 0, limitedItemsSold: {},
        liquidityTon: 0, treasuryTon: 0, rewardPoolNrc: 0, rewardPoolTon: 0, rewardPoolStars: 0,
        marketPoolNrc: 0,
        currentPrice: 0.000001, priceHistory: [], leaderboard: [],
        rewardConfig: { poolPercent: 10, closerPercent: 70, contributorPercent: 20 },
        exchangeConfig: { maxDailySell: 100, maxDailyBuy: 1000 },
        baseDailyReward: 5, quests: []
    };
  }
  
  // Actually fetch global stats
  async fetchGlobal(): Promise<GlobalStats | null> {
      const res = await this.request('/sync');
      return res;
  }

  // MINING LOGIC (Buffered)
  submitHashes(amount: number, currentState: PlayerState): { newPlayerState: PlayerState, blockClosed: boolean, reward: number } {
      // Optimistic Update
      this.hashBuffer += amount;
      
      const newState = { ...currentState };
      // Note: We don't accurately predict balance here because of network difficulty
      // We just increment local hashes for visual, but actual balance comes from server
      // We return the CURRENT state modified optimistically, but the real truth comes from flushBuffer.
      // To prevent jumping, we just accumulate lifetimeHashes visually? 
      // Actually, let's just return input state and let the flush update it.
      
      // OPTIMISTIC FAKE UPDATE (Visual feedback)
      // newState.lifetimeHashes += amount; 
      
      return { newPlayerState: newState, blockClosed: false, reward: 0 };
  }

  async flushBuffer() {
      if (this.hashBuffer <= 0) return;
      
      const amount = this.hashBuffer;
      this.hashBuffer = 0;

      const res = await this.request('/mine', 'POST', { amount });
      if (res && res.user) {
          // We need a way to notify the app. 
          // Since we can't easily push to React state from here without a callback,
          // we assume the App component polls or we implement a listener.
          // For simplicity in this architecture, we rely on the App calling `sync` or 
          // we update a singleton that App reads? No, that's bad.
          
          // REVISION: App.tsx calls `submitHashes`. 
          // We'll change the App to call `flush` explicitly or handle the return of this differently.
          // BUT `submitHashes` is called in a tight loop.
          
          // Let's store the latest server state in a public static variable or event?
          // Simplest: We update `this.lastKnownState`.
          this.lastKnownState = res.user;
          // Also trigger a global stat update if block closed?
          if (res.blockClosed) {
              // trigger haptic?
          }
      }
  }

  // Gets the latest state that was fetched from background flush
  getLastState(): PlayerState {
      return this.lastKnownState;
  }
  
  // --- ACTIONS ---

  async purchaseUpgrade(state: PlayerState, upgradeId: string, currency: 'TON' | 'NRC') {
      const res = await this.request('/action', 'POST', { action: 'purchase_upgrade', payload: { upgradeId, currency }});
      return { success: res?.success, newState: res?.user, message: res?.message };
  }

  async payElectricity(state: PlayerState) {
      const res = await this.request('/action', 'POST', { action: 'pay_electricity' });
      return { success: res?.success, newState: res?.user, message: res?.message };
  }

  async claimDailyReward(state: PlayerState) {
      const res = await this.request('/action', 'POST', { action: 'claim_daily' });
      return { success: res?.success, newState: res?.user, error: res?.message === 'Pool Empty' ? 'POOL EMPTY' : res?.message, reward: res?.reward };
  }
  
  async exchangeCurrency(state: PlayerState, amount: number, type: 'buy' | 'sell') {
      const res = await this.request('/action', 'POST', { action: 'exchange', payload: { amount, type } });
      return { success: res?.success, newState: res?.user, message: res?.message };
  }

  // --- GAMES (Direct API) ---

  async startCrashGame(state: PlayerState, bet: number, currency: string) {
      const res = await this.request('/game/crash/start', 'POST', { bet, currency });
      return { success: res?.success, newState: res?.newState, crashPoint: res?.crashPoint, message: res?.message };
  }

  async cashOutCrashGame(state: PlayerState, bet: number, multiplier: number, currency: string) {
       const res = await this.request('/game/crash/cashout', 'POST', { multiplier });
       return { success: res?.success, newState: res?.newState, payout: res?.payout };
  }

  async playNeonDice(state: PlayerState, bet: number, currency: string, prediction: string) {
       const res = await this.request('/game/dice', 'POST', { bet, currency, prediction });
       return { success: res?.success, newState: res?.newState, dice: res?.dice, payout: res?.payout, message: res?.message };
  }

  async playQuantumSlots(state: PlayerState, bet: number, currency: string) {
      const res = await this.request('/game/slots', 'POST', { bet, currency });
      return { success: res?.success, newState: res?.newState, result: res?.result, payout: res?.payout, isJackpot: res?.isJackpot, message: res?.message };
  }

  async playCyberSpin(state: PlayerState, bet: number, currency: string) {
      const res = await this.request('/game/spin', 'POST', { bet, currency });
      return { success: res?.success, newState: res?.newState, resultItem: res?.resultItem, multiplier: res?.multiplier, payout: res?.payout, message: res?.message };
  }

  // --- ADMIN & MISC ---
  async injectLiquidity(amount: number) {
      const res = await this.request('/action', 'POST', { action: 'inject_liquidity', payload: { amount } });
      return res?.success;
  }
  
  // Helpers
  checkAchievements(state: PlayerState) { return state; } // Handled by server or mostly visual now
  claimAchievementReward(state: PlayerState, id: string) { return { success: false }; } // TODO: Add endpoint
  getLimitedStock(id: string) { return 0; } // Needs global stat
  
  async completeQuest(state: PlayerState, questId: string, reward: number) {
      const res = await this.request('/action', 'POST', { action: 'complete_quest', payload: { questId, reward } });
      return { success: res?.success, newState: res?.user, error: res?.message };
  }

  // Admin Methods with Arguments
  updateBaseDailyReward(amount: number) { /* Mock */ } 
  updateExchangeConfig(config: ExchangeConfig) { /* Mock */ }
  addQuest(quest: Quest) { /* Mock */ }
  deleteQuest(id: string) { /* Mock */ }
  updateRewardConfig(config: RewardConfig) { /* Mock */ }
  saveState() {} 
}

export const GameService = new ApiService();