const fs = require('fs');
const path = require('path');

const isVercel = process.env.VERCEL === '1';
const DB_FILE = path.join(__dirname, 'database.json');

let db = {
    users: [],
    downloads: [],
    github_clones: []
};

let dbReady = false;
let redisClient = null;
let useRedis = false;

async function initRedis() {
    if (!isVercel) {
        console.log('Running locally - using JSON file database');
        loadDb();
        return;
    }

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
        console.log('Redis not configured - falling back to JSON file');
        loadDb();
        return;
    }

    try {
        const { Redis } = require('@upstash/redis');
        redisClient = new Redis({
            url: redisUrl,
            token: redisToken
        });

        await redisClient.ping();
        useRedis = true;
        dbReady = true;
        console.log('Connected to Upstash Redis successfully');
    } catch (err) {
        console.error('Redis connection failed:', err.message);
        loadDb();
    }
}

function loadDb() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            db = JSON.parse(data);
        }
        dbReady = true;
        console.log('Database loaded successfully');
    } catch (err) {
        console.error('Error loading database:', err.message);
        dbReady = true;
    }
}

async function saveDbRedis() {
    if (!useRedis || !redisClient) return;
    try {
        await redisClient.set('bothub_db', JSON.stringify(db), { ex: 86400 });
    } catch (err) {
        console.error('Error saving to Redis:', err.message);
    }
}

function saveDb() {
    if (useRedis) {
        saveDbRedis();
        return;
    }
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error('Error saving database:', err.message);
    }
}

async function loadDbRedis() {
    if (!redisClient) return;
    try {
        const data = await redisClient.get('bothub_db');
        if (data) {
            db = JSON.parse(data);
        }
    } catch (err) {
        console.error('Error loading from Redis:', err.message);
    }
}

function createUser(username, email, password, callback) {
    const existing = db.users.find(u => u.username === username || u.email === email);
    if (existing) {
        callback(new Error('User already exists'), null);
        return;
    }
    
    const user = {
        _id: Date.now().toString(),
        username,
        email,
        password,
        is_verified: false,
        created_at: new Date().toISOString()
    };
    
    db.users.push(user);
    saveDb();
    callback(null, { id: user._id, username: user.username, email: user.email });
}

function findUserByEmail(email, callback) {
    const user = db.users.find(u => u.email === email);
    callback(null, user || null);
}

function findUserByUsername(username, callback) {
    const user = db.users.find(u => u.username === username);
    callback(null, user || null);
}

function findUserByEmailOrUsername(loginInput, callback) {
    const isEmail = loginInput.includes('@');
    const user = db.users.find(u => isEmail ? u.email === loginInput : u.username === loginInput);
    callback(null, user || null);
}

function recordDownload(userId, downloadType, callback) {
    db.downloads.push({
        user_id: userId || null,
        download_type: downloadType || 'rdx',
        download_date: new Date().toISOString().split('T')[0],
        download_time: new Date().toISOString()
    });
    saveDb();
    if (callback) callback(null);
}

function getTotalDownloads(callback) {
    callback(null, db.downloads.length);
}

function getTodayDownloads(callback) {
    const today = new Date().toISOString().split('T')[0];
    const count = db.downloads.filter(d => d.download_date === today).length;
    callback(null, count);
}

function getUserCount(callback) {
    callback(null, db.users.length);
}

function getDownloadsByType(callback) {
    const counts = { rdx: 0, c3c: 0 };
    db.downloads.forEach(d => {
        if (counts[d.download_type] !== undefined) {
            counts[d.download_type]++;
        } else {
            counts.rdx++;
        }
    });
    callback(null, counts);
}

function recordGithubClone(callback) {
    db.github_clones.push({
        clone_date: new Date().toISOString().split('T')[0],
        clone_time: new Date().toISOString()
    });
    saveDb();
    if (callback) callback(null);
}

function getGithubCloneCount(callback) {
    callback(null, db.github_clones.length);
}

function setVerificationCode(userId, code, expires, callback) {
    const user = db.users.find(u => u._id === userId);
    if (user) {
        user.verification_code = code;
        user.verification_expires = expires;
        saveDb();
    }
    if (callback) callback(null, user);
}

function verifyCode(userId, code, callback) {
    const user = db.users.find(u => u._id === userId && u.verification_code === code);
    callback(null, user ? true : false);
}

function isUserVerified(userId, callback) {
    const user = db.users.find(u => u._id === userId);
    callback(null, user ? user.is_verified : false);
}

function getUserById(userId, callback) {
    const user = db.users.find(u => u._id === userId);
    callback(null, user || null);
}

initRedis().then(() => {
    if (useRedis) {
        loadDbRedis();
    }
});

module.exports = {
    db: {
        run: (sql, params, callback) => { if (callback) callback(null); },
        get: (sql, params, callback) => { if (callback) callback(null, null); },
        all: (sql, callback) => { if (callback) callback(null, []); }
    },
    createUser,
    findUserByEmail,
    findUserByUsername,
    findUserByEmailOrUsername,
    recordDownload,
    getTotalDownloads,
    getTodayDownloads,
    getUserCount,
    getDownloadsByType,
    recordGithubClone,
    getGithubCloneCount,
    setVerificationCode,
    verifyCode,
    isUserVerified,
    getUserById
};
