
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONSTANTS ---
const MAX_SUPPLY = 13000000;
const INITIAL_DIFFICULTY = 36000; // 100 H/s * 360s
const EPOCH_LENGTH = 1300;
const TARGET_BLOCK_TIME = 360; // 6 minutes
const HALVING_INTERVAL = 130000;
const INITIAL_BLOCK_REWARD = 50;
const ADMIN_IDS = [7010848744];

// --- ATOMIC DB STORAGE ---
class JSONStore {
    constructor(filename) {
        this.filepath = path.join(__dirname, 'db', filename);
        this.data = {};
        this.writing = false;
        this.queue = false;
    }

    async init(defaultData) {
        try {
            await fs.mkdir(path.dirname(this.filepath), { recursive: true });
            const content = await fs.readFile(this.filepath, 'utf8');
            this.data = JSON.parse(content);
        } catch (e) {
            this.data = defaultData;
            await this.save();
        }
    }

    async save() {
        if (this.writing) {
            this.queue = true;
            return;
        }
        this.writing = true;
        const tempPath = `${this.filepath}.${Date.now()}.tmp`;
        try {
            await fs.writeFile(tempPath, JSON.stringify(this.data, null, 2));
            await fs.rename(tempPath, this.filepath);
        } catch (e) {
            console.error(`DB Write Error (${this.filepath}):`, e);
        } finally {
            this.writing = false;
            if (this.queue) {
                this.queue = false;
                this.save();
            }
        }
    }

    get() { return this.data; }
}

// Databases
const chainDB = new JSONStore('blockchain.json');
const usersDB = new JSONStore('users.json');
const statsDB = new JSONStore('stats.json');

// --- IN-MEMORY MINING POOL ---
// We don't save this to disk on every hash to save IO. 
// Ideally use Redis. Here we use memory + periodic backup if needed.
let currentBlockContributors = new Map(); // UserId -> Hashes Contributed
let currentBlockHashes = 0;

// --- INITIALIZATION ---
(async () => {
    await chainDB.init({
        blockHeight: 0,
        currentDifficulty: INITIAL_DIFFICULTY,
        lastBlockTime: Date.now(),
        epochStartTime: Date.now(),
        totalMined: 0,
        rewardPoolNrc: 1000,
        liquidityTon: 1000,
        treasuryTon: 500
    });

    await usersDB.init({}); // Object: { userId: PlayerState }
    
    await statsDB.init({
        priceHistory: [],
        leaderboard: [],
        totalUsers: 0
    });

    // Restore partial block progress from DB if we implemented persistence for it
    // For now, reset pool on restart (typical for simple pools)
    console.log('[CORE] NeuroCoin Node Started. Height:', chainDB.get().blockHeight);
})();

app.use(cors());
app.use(bodyParser.json());

// --- MIDDLEWARE ---
const verifyAuth = (req, res, next) => {
    // Simplified Dev Mode check
    if (process.env.NODE_ENV === 'development') {
        req.user = { id: req.body.userId || 12345678 };
        return next();
    }
    // Production: Validate Telegram Init Data
    const initData = req.headers['x-telegram-init-data'];
    if (!initData) return res.status(401).json({ error: 'Auth missing' });
    
    // ... Verify Hash Logic Here ...
    // For demo, we trust the ID parsed from string if hash valid
    // Assuming valid for this snippet
    req.user = { id: 12345678 }; // Placeholder
    next();
};

// --- CORE LOGIC: MINING ---
const processBlock = async () => {
    const chain = chainDB.get();
    
    if (chain.totalMined >= MAX_SUPPLY) return null;

    // 1. Calculate Reward
    const currentHalving = Math.floor(chain.blockHeight / HALVING_INTERVAL);
    const blockReward = INITIAL_BLOCK_REWARD / Math.pow(2, currentHalving);
    
    // 2. Distribute Reward (PPS / PPLNS simplified)
    const users = usersDB.get();
    const totalHashes = currentBlockHashes;
    
    // 90% to miners, 10% to pool/treasury
    const minersPot = blockReward * 0.9;
    const treasuryFee = blockReward * 0.1;

    let distributed = 0;

    for (const [userId, hashes] of currentBlockContributors.entries()) {
        if (users[userId]) {
            const share = (hashes / totalHashes) * minersPot;
            users[userId].balance += share;
            users[userId].lifetimeHashes += hashes;
            
            // Electricity Cost Logic (Simulated)
            if (!users[userId].premiumUntil || users[userId].premiumUntil < Date.now()) {
                users[userId].electricityDebt += (share * 0.05);
            }
            
            distributed += share;
        }
    }

    // 3. Update Chain State
    chain.totalMined += blockReward;
    chain.rewardPoolNrc += treasuryFee; // Used for games/daily
    chain.blockHeight++;
    chain.lastBlockTime = Date.now();

    // 4. Difficulty Adjustment (Epoch)
    if (chain.blockHeight % EPOCH_LENGTH === 0) {
        const now = Date.now();
        const actualTimeSeconds = (now - chain.epochStartTime) / 1000;
        const targetTimeSeconds = EPOCH_LENGTH * TARGET_BLOCK_TIME;
        
        let ratio = targetTimeSeconds / actualTimeSeconds;
        // Dampening to prevent massive jumps (max 4x or 0.25x)
        ratio = Math.min(Math.max(ratio, 0.25), 4.0);
        
        chain.currentDifficulty = Math.floor(chain.currentDifficulty * ratio);
        if (chain.currentDifficulty < INITIAL_DIFFICULTY) chain.currentDifficulty = INITIAL_DIFFICULTY;
        
        chain.epochStartTime = now;
        console.log(`[CORE] Difficulty Retarget: New Diff ${chain.currentDifficulty}`);
    }

    // 5. Reset Pool
    currentBlockContributors.clear();
    currentBlockHashes = 0;

    // 6. Save
    await chainDB.save();
    await usersDB.save();

    return {
        height: chain.blockHeight,
        reward: blockReward,
        difficulty: chain.currentDifficulty
    };
};

// --- ENDPOINTS ---

// Submit Hashes (The "Mine" action)
app.post('/api/submit-hashes', verifyAuth, async (req, res) => {
    const { hashes } = req.body;
    const userId = req.user.id;
    const chain = chainDB.get();

    if (!hashes || hashes <= 0) return res.status(400).json({ error: 'Invalid hashes' });
    if (chain.totalMined >= MAX_SUPPLY) return res.json({ status: 'MAX_SUPPLY' });

    // 1. Add to Pool
    const current = currentBlockContributors.get(userId) || 0;
    currentBlockContributors.set(userId, current + hashes);
    currentBlockHashes += hashes;

    let blockInfo = null;

    // 2. Check Block Condition
    if (currentBlockHashes >= chain.currentDifficulty) {
        blockInfo = await processBlock();
    }

    res.json({
        poolHash: currentBlockHashes,
        target: chain.currentDifficulty,
        blockClosed: !!blockInfo,
        newBlock: blockInfo
    });
});

// Sync State (Poll)
app.get('/api/sync', async (req, res) => {
    // Only recalc heavy stats (leaderboard) periodically, not here
    const chain = chainDB.get();
    res.json({
        blockHeight: chain.blockHeight,
        currentDifficulty: chain.currentDifficulty,
        currentBlockHash: currentBlockHashes, // Real-time memory value
        lastBlockTime: chain.lastBlockTime,
        totalMined: chain.totalMined,
        price: statsDB.get().currentPrice || 0.000001
    });
});

// Withdraw TON (Secure Stub)
app.post('/api/withdraw', verifyAuth, async (req, res) => {
    const { amount, address } = req.body;
    const userId = req.user.id;
    const users = usersDB.get();
    const user = users[userId];

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.tonBalance < amount) return res.status(400).json({ error: 'Insufficient funds' });

    // 1. Deduct Balance Atomically
    user.tonBalance -= amount;
    await usersDB.save();

    // 2. Trigger Blockchain Tx (Stub)
    try {
        // const tx = await tonClient.sendTransfer({ ... mnemonic, dest: address, amount });
        console.log(`[WITHDRAW] Sent ${amount} TON to ${address}`);
        res.json({ success: true, txHash: 'stub_tx_hash' });
    } catch (e) {
        // Refund on error
        user.tonBalance += amount;
        await usersDB.save();
        res.status(500).json({ error: 'Transfer failed' });
    }
});

// Background Stats Worker (Every 10s)
setInterval(async () => {
    const users = usersDB.get();
    const list = Object.values(users);
    
    // Calc Leaderboard
    const leaderboard = list
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 50)
        .map((u, i) => ({ rank: i + 1, balance: u.balance, name: 'Miner' })); // Don't leak PII

    // Calc Price (Mock AMM)
    const chain = chainDB.get();
    let price = 0.000001;
    if (chain.totalMined > 0 && chain.liquidityTon > 0) {
        price = chain.liquidityTon / chain.totalMined;
    }

    const stats = statsDB.get();
    stats.leaderboard = leaderboard;
    stats.totalUsers = list.length;
    stats.currentPrice = price;
    
    // Add Price History Point
    stats.priceHistory.push({ time: Date.now(), price });
    if (stats.priceHistory.length > 500) stats.priceHistory.shift();

    await statsDB.save();
}, 10000);

app.listen(PORT, () => {
    console.log(`NeuroCoin Node running on ${PORT}`);
});
