
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000; // Application Port

// Allow all CORS to prevent issues with Telegram Webview
app.use(cors());
app.use(bodyParser.json());

// --- DATABASE SIMULATION (File Based) ---
const DB_FILE = path.join(__dirname, 'database.json');

// Initial State if DB doesn't exist
let DB = {
    users: {}, 
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
        quests: [] 
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

// --- GLOBAL TICKER ---
setInterval(() => {
    const now = Date.now();
    let price = DB.global.currentPrice;
    if (DB.global.totalMined > 0 && DB.global.liquidityTon > 0) {
        const backedPrice = DB.global.liquidityTon / DB.global.totalMined;
        const drift = (Math.random() - 0.5) * (backedPrice * 0.01); 
        price = backedPrice + drift;
    } else {
        price = price * (1 + (Math.random() - 0.5) * 0.01);
    }
    DB.global.currentPrice = Math.max(0.000001, price);

    const lastHist = DB.global.priceHistory[DB.global.priceHistory.length - 1];
    if (!lastHist || (now - lastHist.time > 60000)) {
        DB.global.priceHistory.push({ time: now, price: DB.global.currentPrice });
        if (DB.global.priceHistory.length > 1000) DB.global.priceHistory.shift();
    }
}, 1000);

// --- HELPER FUNCTIONS ---
const INITIAL_PLAYER_STATE = {
    balance: 0,
    tonBalance: 0,
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

const calculateOffline = (user, now) => {
    if (!user.autoMineRate || user.autoMineRate <= 0) return 0;
    const lastSeen = user.lastSaveTime || now;
    const diffSeconds = (now - lastSeen) / 1000;
    if (diffSeconds < 10) return 0; 
    const cappedSeconds = Math.min(diffSeconds, 86400);
    const currentHalving = Math.floor(DB.global.blockHeight / 130000);
    const blockReward = 50 / Math.pow(2, currentHalving);
    const estimatedHashes = user.autoMineRate * cappedSeconds;
    const estimatedReward = (estimatedHashes / DB.global.currentDifficulty) * (blockReward * 0.2);
    return estimatedReward;
};

// --- SERVE STATIC FRONTEND ---
app.use(express.static(path.join(__dirname, '../dist')));

// --- HEALTH CHECK ---
app.get('/health', (req, res) => {
    res.status(200).send('NeuroCoin Server: OK');
});

// --- API ENDPOINTS ---

app.post('/api/init', (req, res) => {
    const { userId, firstName, username } = req.body;
    if (!userId) return res.status(400).json({ error: 'No UserId' });

    let user = DB.users[userId];
    const now = Date.now();
    let offlineEarnings = 0;

    if (!user) {
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
        offlineEarnings = calculateOffline(user, now);
        if (offlineEarnings > 0) {
            user.balance += offlineEarnings;
            user.lifetimeHashes += (user.autoMineRate * Math.min((now - user.lastSaveTime)/1000, 86400));
        }
        user.lastSaveTime = now;
    }

    res.json({ user, global: DB.global, offlineEarnings });
});

app.post('/api/mine', (req, res) => {
    const { userId, amount } = req.body;
    const user = DB.users[userId];
    if (!user) return res.status(404).json({ error: 'User not found' });

    DB.global.currentBlockHash += amount;
    
    const currentHalving = Math.floor(DB.global.blockHeight / 130000);
    const blockReward = 50 / Math.pow(2, currentHalving);
    const { poolPercent, closerPercent, contributorPercent } = DB.global.rewardConfig;
    
    const shareReward = (amount / DB.global.currentDifficulty) * (blockReward * (contributorPercent/100));
    
    user.balance += shareReward;
    user.lifetimeHashes += amount;
    
    let blockClosed = false;
    
    if (DB.global.currentBlockHash >= DB.global.currentDifficulty) {
        blockClosed = true;
        DB.global.blockHeight++;
        DB.global.currentBlockHash = 0;
        const closeReward = blockReward * (closerPercent / 100);
        user.balance += closeReward;
        DB.global.rewardPoolNrc += blockReward * (poolPercent / 100);
        DB.global.totalMined += blockReward;
        DB.global.lastBlockTime = Date.now();
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

app.post('/api/sync', (req, res) => {
    const { userId, state } = req.body;
    let user = DB.users[userId];
    if (user && state) {
        user.upgrades = state.upgrades || user.upgrades;
        user.clickPower = state.clickPower;
        user.autoMineRate = state.autoMineRate;
        user.walletAddress = state.walletAddress;
        user.achievements = state.achievements;
        user.dailySoldNrc = state.dailySoldNrc;
        user.dailyBoughtNrc = state.dailyBoughtNrc;
        user.lastExchangeDate = state.lastExchangeDate;
        user.tonBalance = state.tonBalance; 
        user.balance = state.balance; 
        user.lastSaveTime = Date.now();
    }
    res.json({ global: DB.global });
});

app.post('/api/purchase', (req, res) => {
    const { userId, itemId, currency, cost } = req.body;
    const user = DB.users[userId];
    if (!user) return res.status(404).json({error: 'User not found'});

    if (currency === 'TON') {
        user.tonBalance -= cost;
        DB.global.treasuryTon += cost * 0.9;
        DB.global.liquidityTon += cost * 0.1;
    } else {
        if (user.balance < cost) return res.status(400).json({error: 'Insufficient funds'});
        user.balance -= cost;
        DB.global.rewardPoolNrc += cost;
    }
    
    if (DB.global.limitedItemsSold[itemId] !== undefined) {
        DB.global.limitedItemsSold[itemId]++;
    }

    res.json({ success: true, balance: user.balance, tonBalance: user.tonBalance });
});

// CATCH-ALL ROUTE
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`NeuroCoin Server running on port ${PORT}`);
    console.log(`Ready for Reverse Proxy (Nginx) from http://chatgpt-helper.ru`);
});
