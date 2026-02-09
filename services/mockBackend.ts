
import { PlayerState, GlobalStats, Quest, ExchangeConfig, RewardConfig } from '../types';
import { INITIAL_STATE } from '../constants';

// Point to local server by default for development. 
// In a real build, this might be '/api' via proxy or an env var.
const API_URL = 'http://localhost:3001/api'; 

class ApiService {
  private hashBuffer: number = 0;
  private syncInterval: any | null = null;
  private lastKnownState: PlayerState = INITIAL_STATE;
  
  // New: Offline Mode flag to prevent error spam if server is down
  private offlineMode = false;

  constructor() {
    // Auto-flush buffer every 3s
    this.syncInterval = setInterval(() => this.flushBuffer(), 3000);
  }

  // --- API HELPER ---
  private async request(endpoint: string, methodInput: string = 'GET', body?: any) {
    // 1. If we already know we are offline, skip network request entirely
    if (this.offlineMode) {
        return this.mockResponse(endpoint, methodInput, body);
    }

    const method = methodInput.toUpperCase();
    const initData = window.Telegram?.WebApp?.initData || '';
    
    const headers: Record<string, string> = {
      'x-telegram-init-data': initData
    };

    const options: RequestInit = {
      method,
      headers,
    };

    // 2. STRICTLY only add body for non-GET/HEAD methods
    if (method !== 'GET' && method !== 'HEAD') {
        headers['Content-Type'] = 'application/json';
        
        let payload = body || {};
        // Dev fallback if no TG data
        if (!initData) {
            payload = { ...payload, userId: 12345678 }; 
        }
        
        options.body = JSON.stringify(payload);
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, options);
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      return await res.json();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      
      // 3. Catch Network/Fetch Errors and switch to Offline Mode
      if (
          msg.includes('Failed to fetch') || 
          msg.includes('Load failed') || 
          msg.includes('NetworkError') ||
          (e instanceof TypeError)
      ) {
          if (!this.offlineMode) {
              console.warn(`[Backend Offline] Could not reach ${API_URL}. Switching to Local Mock Mode.`);
              this.offlineMode = true;
          }
          return this.mockResponse(endpoint, methodInput, body);
      }
      
      console.error(`API Request Failed: ${endpoint}`, e);
      return null;
    }
  }

  // --- MOCK FALLBACK SYSTEM ---
  private mockResponse(endpoint: string, method: string, body: any): any {
      // Simulate simple responses for offline functionality
      if (endpoint === '/init') {
          return { user: this.lastKnownState, global: this.getGlobalStats(0) };
      }
      if (endpoint === '/sync') {
          // Increment mock global stats slightly to show activity
          const stats = this.getGlobalStats(0);
          stats.totalMined += Math.random() * 10;
          return stats;
      }
      if (endpoint === '/mine') {
          const amount = body?.amount || 0;
          // Simple offline mining simulation
          this.lastKnownState.balance += amount * 0.001; // Tiny reward offline
          return { 
              user: this.lastKnownState, 
              global: this.getGlobalStats(0), 
              reward: amount * 0.001, 
              blockClosed: false 
          };
      }
      // Default success for actions
      return { success: true, message: "Offline: Action simulated", user: this.lastKnownState };
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

  // Synchronous placeholder
  getGlobalStats(balance: number): GlobalStats {
    // Generate a slightly dynamic placeholder
    const now = Date.now();
    return {
        totalUsers: 1337, 
        totalMined: 5000000 + (now % 10000), 
        activeMiners: 42, 
        blockHeight: Math.floor(now / 100000), 
        currentDifficulty: 36000,
        currentBlockHash: (now % 36000), 
        lastBlockTime: now - (now % 5000), 
        epochStartTime: now - 100000, 
        marketCap: 250000, 
        limitedItemsSold: {},
        liquidityTon: 5000, 
        treasuryTon: 1000, 
        rewardPoolNrc: 20000, 
        rewardPoolTon: 500, 
        rewardPoolStars: 10000,
        marketPoolNrc: 0,
        currentPrice: 0.000001, 
        priceHistory: Array.from({length: 20}, (_, i) => ({ time: now - i*3600000, price: 0.000001 + Math.random()*0.0000005 })), 
        leaderboard: [],
        rewardConfig: { poolPercent: 10, closerPercent: 70, contributorPercent: 20 },
        exchangeConfig: { maxDailySell: 100, maxDailyBuy: 1000 },
        baseDailyReward: 5, 
        quests: []
    };
  }
  
  async fetchGlobal(): Promise<GlobalStats | null> {
      // Explicit GET request
      const res = await this.request('/sync', 'GET'); 
      return res; 
  }

  // MINING LOGIC (Buffered)
  submitHashes(amount: number, currentState: PlayerState): { newPlayerState: PlayerState, blockClosed: boolean, reward: number } {
      // Optimistic Update
      this.hashBuffer += amount;
      const newState = { ...currentState };
      return { newPlayerState: newState, blockClosed: false, reward: 0 };
  }

  async flushBuffer() {
      if (this.hashBuffer <= 0) return;
      const amount = this.hashBuffer;
      this.hashBuffer = 0;

      const res = await this.request('/mine', 'POST', { amount });
      if (res && res.user) {
          this.lastKnownState = res.user;
      }
  }

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
      return { success: res?.success, newState: res?.user, message: res?.message, reward: res?.reward };
  }
  
  async exchangeCurrency(state: PlayerState, amount: number, type: 'buy' | 'sell') {
      const res = await this.request('/action', 'POST', { action: 'exchange', payload: { amount, type } });
      return { success: res?.success, newState: res?.user, message: res?.message };
  }

  // --- GAMES (Direct API) ---

  async startCrashGame(state: PlayerState, bet: number, currency: string) {
      const res = await this.request('/game/crash/start', 'POST', { bet, currency });
      // Mock logic for offline crash
      if (this.offlineMode) return { success: true, newState: state, crashPoint: 1.00 + Math.random() * 5, message: "Offline Game" };
      return { success: res?.success, newState: res?.newState, crashPoint: res?.crashPoint, message: res?.message };
  }

  async cashOutCrashGame(state: PlayerState, bet: number, multiplier: number, currency: string) {
       const res = await this.request('/game/crash/cashout', 'POST', { multiplier });
       if (this.offlineMode) return { success: true, newState: state, payout: bet * multiplier };
       return { success: res?.success, newState: res?.newState, payout: res?.payout };
  }

  async playNeonDice(state: PlayerState, bet: number, currency: string, prediction: string) {
       const res = await this.request('/game/dice', 'POST', { bet, currency, prediction });
       if (this.offlineMode) return { success: true, newState: state, dice: [3, 4], payout: 0, message: "Offline" };
       return { success: res?.success, newState: res?.newState, dice: res?.dice, payout: res?.payout, message: res?.message };
  }

  async playQuantumSlots(state: PlayerState, bet: number, currency: string) {
      const res = await this.request('/game/slots', 'POST', { bet, currency });
      if (this.offlineMode) return { success: true, newState: state, result: ['7','7','7'], payout: bet*10, isJackpot: false, message: "Offline Win" };
      return { success: res?.success, newState: res?.newState, result: res?.result, payout: res?.payout, isJackpot: res?.isJackpot, message: res?.message };
  }

  async playCyberSpin(state: PlayerState, bet: number, currency: string) {
      const res = await this.request('/game/spin', 'POST', { bet, currency });
      if (this.offlineMode) return { success: true, newState: state, resultItem: 'shard', multiplier: 0.5, payout: 0, message: "Offline" };
      return { success: res?.success, newState: res?.newState, resultItem: res?.resultItem, multiplier: res?.multiplier, payout: res?.payout, message: res?.message };
  }

  // --- ADMIN & MISC ---
  async injectLiquidity(amount: number) {
      const res = await this.request('/action', 'POST', { action: 'inject_liquidity', payload: { amount } });
      return res?.success || (this.offlineMode && true);
  }
  
  checkAchievements(state: PlayerState) { return state; }
  
  async claimAchievementReward(state: PlayerState, id: string) {
      // Offline compatible
      return { success: true, newState: state }; 
  } 
  
  getLimitedStock(id: string) { return 0; } 
  
  async completeQuest(state: PlayerState, questId: string, reward: number) {
      const res = await this.request('/action', 'POST', { action: 'complete_quest', payload: { questId, reward } });
      if (this.offlineMode) return { success: true, newState: state };
      return { success: res?.success, newState: res?.user, error: res?.message };
  }

  updateBaseDailyReward(amount: number) { /* Mock */ } 
  updateExchangeConfig(config: ExchangeConfig) { /* Mock */ }
  addQuest(quest: Quest) { /* Mock */ }
  deleteQuest(id: string) { /* Mock */ }
  updateRewardConfig(config: RewardConfig) { /* Mock */ }
  saveState(state: PlayerState) {
      this.lastKnownState = state;
  } 
}

export const GameService = new ApiService();
