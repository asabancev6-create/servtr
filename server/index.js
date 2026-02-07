
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIG ---
// Allow requests from your domain and localhost (for testing)
const ALLOWED_ORIGINS = [
    'https://chatgpt-helper.ru', 
    'https://www.chatgpt-helper.ru',
    'http://localhost:5173', // Vite local
    'http://localhost:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || ALLOWED_ORIGINS.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(bodyParser.json());

// --- CONSTANTS ---
const MAX_SUPPLY = 13000000;
const INITIAL_DIFFICULTY = 36000;
const EPOCH_LENGTH = 1300;
const TARGET_BLOCK_TIME = 360; 
const HALVING_INTERVAL = 130000;
const INITIAL_BLOCK_REWARD = 50;

// --- DB STORAGE (Simple JSON) ---
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

const chainDB = new JSONStore('blockchain.json');
const usersDB = new JSONStore('users.json');
const statsDB = new JSONStore('stats.json');

// --- IN-MEMORY POOL ---
let currentBlockContributors = new Map();
let currentBlockHashes = 0;

// --- STARTUP ---
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
    await usersDB.init({});
    await statsDB.init({ priceHistory: [], leaderboard: [], totalUsers: 0 });
    console.log(`[NEUROCOIN] Server Active on ${PORT}`);
})();

// --- MIDDLEWARE ---
const verifyAuth = (req, res, next) => {
    // In production, you would validate the Telegram Hash here using process.env.BOT_TOKEN
    // For now, we allow the request but log it.
    // const initData = req.headers['x-telegram-init-data'];
    // TODO: Implement HMAC SHA256 validation
    next();
};

// --- ROUTES ---

// 1. SYNC STATE (Called by Client every 2s)
app.get('/api/sync', async (req, res) => {
    const chain = chainDB.get();
    const stats = statsDB.get();
    
    res.json({
        totalUsers: stats.totalUsers,
        totalMined: chain.totalMined,
        activeMiners: currentBlockContributors.size + 1, // +1 for self
        blockHeight: chain.blockHeight,
        currentDifficulty: chain.currentDifficulty,
        currentBlockHash: currentBlockHashes,
        lastBlockTime: chain.lastBlockTime,
        epochStartTime: chain.epochStartTime,
        liquidityTon: chain.liquidityTon,
        treasuryTon: chain.treasuryTon,
        rewardPoolNrc: chain.rewardPoolNrc,
        price: stats.currentPrice || 0.000001,
        priceHistory: stats.priceHistory
    });
});

// 2. MINING SUBMISSION
app.post('/api/submit-hashes', verifyAuth, async (req, res) => {
    const { hashes, userId } = req.body;
    const chain = chainDB.get();

    if (!hashes || hashes <= 0) return res.status(400).json({ error: 'Invalid hashes' });
    if (chain.totalMined >= MAX_SUPPLY) return res.json({ status: 'MAX_SUPPLY' });

    // Add to Pool
    const current = currentBlockContributors.get(userId) || 0;
    currentBlockContributors.set(userId, current + hashes);
    currentBlockHashes += hashes;

    let blockInfo = null;

    // Check Block
    if (currentBlockHashes >= chain.currentDifficulty) {
        // Block Found!
        const currentHalving = Math.floor(chain.blockHeight / HALVING_INTERVAL);
        const blockReward = INITIAL_BLOCK_REWARD / Math.pow(2, currentHalving);
        
        // Update Chain
        chain.totalMined += blockReward;
        chain.blockHeight++;
        chain.lastBlockTime = Date.now();
        chain.rewardPoolNrc += (blockReward * 0.1); // 10% tax

        // Difficulty Calc
        if (chain.blockHeight % EPOCH_LENGTH === 0) {
            const now = Date.now();
            const actualTime = (now - chain.epochStartTime) / 1000;
            const targetTime = EPOCH_LENGTH * TARGET_BLOCK_TIME;
            let ratio = targetTime / Math.max(1, actualTime);
            ratio = Math.min(Math.max(ratio, 0.25), 4.0);
            
            chain.currentDifficulty = Math.floor(chain.currentDifficulty * ratio);
            if (chain.currentDifficulty < INITIAL_DIFFICULTY) chain.currentDifficulty = INITIAL_DIFFICULTY;
            chain.epochStartTime = now;
        }

        blockInfo = { height: chain.blockHeight, reward: blockReward };
        
        // Reset Pool
        currentBlockContributors.clear();
        currentBlockHashes = 0;
        
        await chainDB.save();
    }

    res.json({
        poolHash: currentBlockHashes,
        target: chain.currentDifficulty,
        blockClosed: !!blockInfo,
        newBlock: blockInfo
    });
});

// --- STATS WORKER (10s) ---
setInterval(async () => {
    const users = usersDB.get();
    const list = Object.values(users);
    const chain = chainDB.get();
    
    // Simple Price Model: Liquidity / Mined
    let price = 0.000001;
    if (chain.totalMined > 0 && chain.liquidityTon > 0) {
        price = chain.liquidityTon / chain.totalMined;
    }

    const stats = statsDB.get();
    stats.totalUsers = list.length > 0 ? list.length : 1; // Prevent 0 div
    stats.currentPrice = price;
    
    stats.priceHistory.push({ time: Date.now(), price });
    if (stats.priceHistory.length > 100) stats.priceHistory.shift();

    await statsDB.save();
}, 10000);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
