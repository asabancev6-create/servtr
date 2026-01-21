
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000; // Running on port 3000 behind Nginx usually

app.use(cors());
app.use(bodyParser.json());

// --- DATABASE SIMULATION (File Based) ---
const DB_FILE = path.join(__dirname, 'database.json');

// Initial State if DB doesn't exist
let DB = {
    users: {}, // userId -> PlayerState
    global: {
        totalUsers: 0,
        totalMined: 0,
        activeMiners: 0,
        blockHeight: 0,
        currentDifficulty: 36000,
        currentBlockHash: 0,
        lastBlockTime: Date.now(),
        epochStartTime: Date.now(),
        liquidityTon: 0,
        treasuryTon: 0,
        rewardPoolNrc: 0,
        rewardPoolTon: 0,
        currentPrice: 0.000001,
        priceHistory: [],
        limitedItemsSold: {},
        rewardConfig: { poolPercent: 10, closerPercent: 70, contributorPercent: 20 },
        exchangeConfig: { maxDailySell: 100, maxDailyBuy: 1000 },
        baseDailyReward: 5,
        quests: [] // Quest list
    }
};

// Load DB
if (fs.existsSync(DB_FILE)) {
    try {
        const raw = fs.readFileSync(DB_FILE);
        DB = JSON.parse(raw);
        console.log('Database loaded.');
    } catch (e) {
        console.error('Database load failed, using initial.', e);
    }
} else {
    saveDB();
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2));
}

// Auto-Save every 30s
setInterval(saveDB, 30000);

// --- GLOBAL TICKER (The Heart of the Blockchain) ---
// Runs every second to simulate network activity and price fluctuations
setInterval(() => {
    const now = Date.now();
    
    // 1. Price Fluctuation (Random Walk + Liquidity Logic)
    let price = DB.global.currentPrice;
    if (DB.global.totalMined > 0 && DB.global.liquidityTon > 0) {
        // Floor price based on liquidity
        const backedPrice = DB.global.liquidityTon / DB.global.totalMined;
        // Market drift
        const drift = (Math.random() - 0.5) * (backedPrice * 0.01); 
        price = backedPrice + drift;
    } else {
        // Pseudo-random drift for start
        price = price * (1 + (Math.random() - 0.5) * 0.01);
    }
    DB.global.currentPrice = Math.max(0.000001, price);

    // 2. Record History every minute
    const lastHist = DB.global.priceHistory[DB.global.priceHistory.length - 1];
    if (!lastHist || (now - lastHist.time > 60000)) {
        DB.global.priceHistory.push({ time: now, price: DB.global.currentPrice });
        if (DB.global.priceHistory.length > 1000) DB.global.priceHistory.shift();
    }

    // 3. Difficulty Adjustment (Epoch)
    // Simplified: Adjust every 10 minutes based on block time
    // This logic is complex, keeping it simple for stability in demo
    
}, 1000);

// --- HELPER FUNCTIONS ---

const INITIAL_PLAYER_STATE = {
    balance: 0,
    tonBalance: 0,
    starsBalance: 0,
    walletAddress: null,
    clickPower: 100,
    autoMineRate: 0,
    upgrades: {},
    lastSaveTime: Date.now(),
    lifetimeHashes: 0,
    premiumUntil: 0,
    lastDailyRewardClaim: 0,
    dailyStreak: 0,
    completedQuestIds: [],
    achievements: {},
    referrals: 0,
    referralEarnings: 0,
    dailySoldNrc: 0,
    dailyBoughtNrc: 0,
    lastExchangeDate: 0
};

// Calculate Offline Earnings
const calculateOffline = (user, now) => {
    if (!user.autoMineRate || user.autoMineRate <= 0) return 0;
    
    const lastSeen = user.lastSaveTime || now;
    const diffSeconds = (now - lastSeen) / 1000;
    
    if (diffSeconds < 10) return 0; // Ignore short disconnects
    
    // Cap at 24 hours
    const cappedSeconds = Math.min(diffSeconds, 86400);
    
    // Global Difficulty Factor
    const currentHalving = Math.floor(DB.global.blockHeight / 130000);
    const blockReward = 50 / Math.pow(2, currentHalving);
    
    // Hashrate to NRC conversion (Estimated share)
    // Formula: (UserHash * Time) / Difficulty * Reward * ContributorShare(20%)
    const estimatedHashes = user.autoMineRate * cappedSeconds;
    const estimatedReward = (estimatedHashes / DB.global.currentDifficulty) * (blockReward * 0.2);
    
    return estimatedReward;
};

// --- API ENDPOINTS ---

// 1. INIT / SYNC
// Call this when app starts. Returns Global Stats + User State
app.post('/api/init', (req, res) => {
    const { userId, firstName, username } = req.body;
    
    if (!userId) return res.status(400).json({ error: 'No UserId' });

    let user = DB.users[userId];
    const now = Date.now();
    let offlineEarnings = 0;

    if (!user) {
        // Register New User
        user = { 
            ...INITIAL_PLAYER_STATE, 
            id: userId,
            firstName,
            username,
            registeredAt: now,
            lastSaveTime: now 
        };
        DB.users[userId] = user;
        DB.global.totalUsers++;
    } else {
        // Calculate Offline
        offlineEarnings = calculateOffline(user, now);
        if (offlineEarnings > 0) {
            user.balance += offlineEarnings;
            // Also update lifetime hashes for leveling
            user.lifetimeHashes += (user.autoMineRate * Math.min((now - user.lastSaveTime)/1000, 86400));
        }
        user.lastSaveTime = now;
    }

    res.json({
        user,
        global: DB.global,
        offlineEarnings
    });
});

// 2. MINE (Submit Hashes)
app.post('/api/mine', (req, res) => {
    const { userId, amount } = req.body;
    const user = DB.users[userId];
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Validate (Simple anti-cheat: check if amount is feasible within timeframe)
    // Skipping complex validation for demo simplicity

    // Update Global Chain
    DB.global.currentBlockHash += amount;
    
    // Reward Logic (PPS)
    const currentHalving = Math.floor(DB.global.blockHeight / 130000);
    const blockReward = 50 / Math.pow(2, currentHalving);
    const { poolPercent, closerPercent, contributorPercent } = DB.global.rewardConfig;
    
    const shareReward = (amount / DB.global.currentDifficulty) * (blockReward * (contributorPercent/100));
    
    user.balance += shareReward;
    user.lifetimeHashes += amount;
    
    let blockClosed = false;
    
    // Check Block Close
    if (DB.global.currentBlockHash >= DB.global.currentDifficulty) {
        blockClosed = true;
        DB.global.blockHeight++;
        DB.global.currentBlockHash = 0;
        
        // Closer Reward
        const closeReward = blockReward * (closerPercent / 100);
        user.balance += closeReward;
        
        // Pool Fee
        DB.global.rewardPoolNrc += blockReward * (poolPercent / 100);
        DB.global.totalMined += blockReward;
        DB.global.lastBlockTime = Date.now();
        
        // Difficulty Retarget logic could go here
    }

    user.lastSaveTime = Date.now();
    
    res.json({
        balance: user.balance,
        lifetimeHashes: user.lifetimeHashes,
        global: {
            blockHeight: DB.global.blockHeight,
            currentBlockHash: DB.global.currentBlockHash,
            currentDifficulty: DB.global.currentDifficulty
        },
        blockClosed
    });
});

// 3. SYNC (Periodic Heartbeat)
app.post('/api/sync', (req, res) => {
    const { userId, state } = req.body; // Client sends their state (optimistic updates)
    let user = DB.users[userId];
    
    if (user && state) {
        // Merge strategy: Server trusts client for upgrades/settings, 
        // but Server authority on Balance for security (in real app).
        // For this demo, we blindly trust upgrades but sanity check balance if needed.
        
        // We actually want to SAVE the state sent by client if they bought something locally
        user.upgrades = state.upgrades || user.upgrades;
        user.clickPower = state.clickPower;
        user.autoMineRate = state.autoMineRate;
        user.walletAddress = state.walletAddress;
        user.achievements = state.achievements;
        user.dailySoldNrc = state.dailySoldNrc;
        user.dailyBoughtNrc = state.dailyBoughtNrc;
        user.lastExchangeDate = state.lastExchangeDate;
        user.tonBalance = state.tonBalance; // In simulation we trust client wallet
        
        // Balance is updated via /mine endpoint mostly, but we sync just in case of drifts
        // Ideally we don't overwrite balance from client to avoid hacks, 
        // but we'll accept it here for 'Purchase' deduction sync.
        user.balance = state.balance; 
        
        user.lastSaveTime = Date.now();
    }

    res.json({
        global: DB.global
    });
});

// 4. PURCHASE (Server-side validation)
app.post('/api/purchase', (req, res) => {
    const { userId, itemId, currency, cost } = req.body;
    const user = DB.users[userId];
    if (!user) return res.status(404).json({error: 'User not found'});

    // Deduct Funds
    if (currency === 'TON') {
        // In real app, we verify TON transaction hash here
        user.tonBalance -= cost;
        DB.global.treasuryTon += cost * 0.9;
        DB.global.liquidityTon += cost * 0.1;
    } else {
        if (user.balance < cost) return res.status(400).json({error: 'Insufficient funds'});
        user.balance -= cost;
        DB.global.rewardPoolNrc += cost;
    }
    
    // Logic for item add is handled on client state then synced via /sync, 
    // or we can return new state here.
    // For limited items:
    if (DB.global.limitedItemsSold[itemId] !== undefined) {
        DB.global.limitedItemsSold[itemId]++;
    } else {
        // check if limited
    }

    res.json({ success: true, balance: user.balance, tonBalance: user.tonBalance });
});

app.listen(PORT, () => {
    console.log(`NeuroCoin Backend running on port ${PORT}`);
});
    