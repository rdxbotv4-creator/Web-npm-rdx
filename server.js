const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const nodemailer = require('nodemailer');

// Email transporter configuration - DISABLED
// Email verification has been disabled for this website
// const emailConfig = {
//     host: 'smtp.gmail.com',
//     port: 587,
//     secure: false,
//     tls: {
//         rejectUnauthorized: false
//     },
//     auth: {
//         user: 'sardarrdxrdx@gmail.com',
//         pass: process.env.EMAIL_PASS || '' // App Password from Gmail
//     }
// };

// Create transporter - DISABLED
// let transporter;
// try {
//     transporter = nodemailer.createTransport(emailConfig);
//     console.log('Email transporter created successfully');
// } catch (err) {
//     console.error('Error creating email transporter:', err);
// }

const app = express();
// Dynamic PORT - supports bot hosting (Heroku, Render, Railway, etc.)
const PORT = process.env.PORT || process.env.NODE_PORT || process.env.APP_PORT || 20227;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve current folder as main website
app.use(express.static(__dirname));

// Serve public folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve static HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve home/dashboard page
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve htdocs subpages
app.get('/features', (req, res) => {
    res.sendFile(path.join(__dirname, 'features.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'contact.html'));
});

// ============================================
// API ROUTES
// ============================================

// Generate random verification code - DISABLED
// function generateVerificationCode() {
//     return Math.floor(100000 + Math.random() * 900000).toString();
// }

// Validate email - only allow gmail.com and outlook.com - DISABLED (now allows all emails)
function isValidEmail(email) {
    // Email verification disabled - accept all valid email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Send verification email - DISABLED
// function sendVerificationEmail(email, code) {
//     if (!transporter) {
//         console.error('Email transporter not configured');
//         return Promise.reject(new Error('Email service not configured'));
//     }

//     const mailOptions = {
//         from: 'RDX Bot <sardarrdxrdx@gmail.com>',
//         to: email,
//         subject: 'RDX Bot - Email Verification Code',
//         html: `
//             <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
//                 <h2 style="color: #1877F2;">RDX Bot - Email Verification</h2>
//                 <p>Thank you for signing up! Your verification code is:</p>
//                 <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 10px;">
//                     ${code}
//                 </div>
//                 <p>This code will expire in 24 hours.</p>
//                 <p style="color: #666; font-size: 12px;">If you didn't create an account, please ignore this email.</p>
//             </div>
//         `
//     };

//     return transporter.sendMail(mailOptions)
//         .then(info => {
//             console.log('Email sent:', info.response);
//             return info;
//         })
//         .catch(err => {
//             console.error('Error sending email:', err.message);
//             throw err;
//         });
// }

// Signup API - sends verification code
app.post('/api/signup', (req, res) => {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'All fields are required'
        });
    }

    // Password validation: at least 1 capital, 1 lowercase, 1 number, 1 symbol
    const hasCapital = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasCapital || !hasLowercase || !hasNumber || !hasSymbol) {
        return res.status(400).json({
            success: false,
            message: 'Password must contain at least 1 capital letter, 1 small letter, 1 number, and 1 symbol'
        });
    }

    // Validate email domain
    if (!isValidEmail(email)) {
        return res.status(400).json({
            success: false,
            message: 'Only gmail.com and outlook.com emails are allowed'
        });
    }

    // Check if email already exists
    db.findUserByEmail(email, (err, user) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Database error'
            });
        }

        if (user) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Check if username already exists
        db.findUserByUsername(username, (err, existingUser) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Database error'
                });
            }

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Username already taken'
                });
            }

            // Create new user
            db.createUser(username, email, password, (err, newUser) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: 'Error creating account'
                    });
                }

                res.json({
                    success: true,
                    message: 'Account created successfully!',
                    user: { id: newUser.id, username: newUser.username, email: newUser.email }
                });
            });
        });
    });
});

// Login API - supports username or email login
app.post('/api/login', (req, res) => {
    const { loginInput, password } = req.body;

    if (!loginInput || !password) {
        return res.status(400).json({
            success: false,
            message: 'Username/Email and password required'
        });
    }

    // Find user by email or username
    db.findUserByEmailOrUsername(loginInput, (err, user) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Database error'
            });
        }

        if (!user || user.password !== password) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username/email or password'
            });
        }

        res.json({
            success: true,
            message: 'Login successful',
            user: { id: user.id, username: user.username, email: user.email }
        });
    });
});

// Verify email endpoint - DISABLED
app.post('/api/verify', (req, res) => {
    res.status(410).json({
        success: false,
        message: 'Email verification has been disabled'
    });
});

// Resend verification code endpoint - DISABLED
app.post('/api/resend-code', (req, res) => {
    res.status(410).json({
        success: false,
        message: 'Email verification has been disabled'
    });
});

// Get user count
app.get('/api/users/count', (req, res) => {
    db.getUserCount((err, count) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching count'
            });
        }

        res.json({
            success: true,
            count: count || 0
        });
    });
});

// Get download counts
app.get('/api/downloads/count', (req, res) => {
    db.getTotalDownloads((err, total) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching count'
            });
        }

        db.getTodayDownloads((err, today) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Error fetching count'
                });
            }

            res.json({
                success: true,
                total: total || 0,
                today: today || 0
            });
        });
    });
});

// Record download
app.post('/api/downloads', (req, res) => {
    const { userId, downloadType } = req.body;

    db.recordDownload(userId || null, downloadType || 'rdx', (err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error recording download'
            });
        }

        // Get updated counts
        db.getTotalDownloads((err, total) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Error fetching count'
                });
            }

            db.getTodayDownloads((err, today) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: 'Error fetching count'
                    });
                }

                res.json({
                    success: true,
                    message: 'Download recorded',
                    total: total,
                    today: today
                });
            });
        });
    });
});

// Record GitHub clone
app.post('/api/github/clones', (req, res) => {
    db.recordGithubClone((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error recording GitHub clone'
            });
        }

        res.json({
            success: true,
            message: 'GitHub clone recorded'
        });
    });
});

// Get GitHub clone count
app.get('/api/github/count', (req, res) => {
    db.getGithubCloneCount((err, count) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching count'
            });
        }

        res.json({
            success: true,
            count: count || 0
        });
    });
});

// ============================================
// DOWNLOAD ROUTES FOR ZIP FILES
// ============================================

// Download RDX Bot
app.get('/download/rdx', (req, res) => {
    const filePath = path.join(__dirname, 'roots', 'RDX-0.7-main.zip');

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            message: 'RDX Bot file not found'
        });
    }

    // Set headers for proper zip download
    res.setHeader('Content-Disposition', 'attachment; filename="RDX-0.7-main.zip"');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', fs.statSync(filePath).size);
    res.setHeader('Cache-Control', 'no-cache');

    // Stream the file directly
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    fileStream.on('error', (err) => {
        console.error('Stream error:', err);
        res.end();
    });
});

// Download C3C Extension
app.get('/download/c3c', (req, res) => {
    const filePath = path.join(__dirname, 'roots', 'c3c-fbstate-1.5.zip');

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            message: 'C3C Extension file not found'
        });
    }

    // Set headers for proper zip download
    res.setHeader('Content-Disposition', 'attachment; filename="c3c-fbstate-1.5.zip"');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', fs.statSync(filePath).size);
    res.setHeader('Cache-Control', 'no-cache');

    // Stream the file directly
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    fileStream.on('error', (err) => {
        console.error('Stream error:', err);
        res.end();
    });
});

// Get download counts by type
app.get('/api/downloads/bytype', (req, res) => {
    db.getDownloadsByType((err, counts) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching counts'
            });
        }

        res.json({
            success: true,
            rdx: counts.rdx || 0,
            c3c: counts.c3c || 0,
            total: (counts.rdx || 0) + (counts.c3c || 0)
        });
    });
});

// ============================================
// DYNAMIC COMMANDS API
// Reads all .js files from commands folder
// ============================================

// Get all commands
app.get('/api/commands', (req, res) => {
    const commandsDir = path.join(__dirname, 'commands');
    const commands = [];

    try {
        // Read all files from commands directory
        const files = fs.readdirSync(commandsDir);

        files.forEach(file => {
            if (file.endsWith('.js') && file !== 'commands.js' && file !== 'commands-data.js') {
                try {
                    const commandPath = path.join(commandsDir, file);
                    const fileContent = fs.readFileSync(commandPath, 'utf-8');

                    // Try to extract info from file content using regex
                    let cmdName = null;
                    let cmdDesc = 'No description';
                    let cmdCategory = 'utility';
                    let cmdUsage = '';
                    let cmdPremium = false;
                    let cmdIcon = 'terminal';
                    let cmdColor = 'blue';

                    // Try various patterns
                    // Pattern 1: module.exports = { config: { name: "...", description: "..." } }
                    let match = fileContent.match(/module\.exports\s*=\s*{[^}]*config:\s*{([^}]+)}/s);
                    if (match) {
                        const configStr = match[1];
                        const nameMatch = configStr.match(/name:\s*["']?([^"'"]+)/i);
                        const descMatch = configStr.match(/description:\s*["']?([^"'"]+)/i);
                        const catMatch = configStr.match(/commandCategory:\s*["']?([^"'"]+)/i) || configStr.match(/category:\s*["']?([^"'"]+)/i);
                        const usageMatch = configStr.match(/usage[s]?:\s*["']?([^"'"]+)/i);
                        const premiumMatch = configStr.match(/premium:\s*(true|false)/i);

                        if (nameMatch) {
                            cmdName = nameMatch[1];
                            cmdDesc = descMatch ? descMatch[1] : 'No description';
                            cmdCategory = catMatch ? catMatch[1].toLowerCase() : 'utility';
                            cmdUsage = usageMatch ? usageMatch[1] : '/' + cmdName;
                            cmdPremium = premiumMatch ? premiumMatch[1] === 'true' : false;
                        }
                    }
                    // Pattern 2: module.exports = { name: "...", description: "..." }
                    else {
                        match = fileContent.match(/module\.exports\s*=\s*{([^}]+(?:{[^}]*}[^}]*)*)}/s);
                        if (match) {
                            const exportStr = match[1];
                            const nameMatch = exportStr.match(/name:\s*["']?([^"'"]+)/i);
                            const descMatch = exportStr.match(/description:\s*["']?([^"'"]+)/i);
                            const catMatch = exportStr.match(/category:\s*["']?([^"'"]+)/i);
                            const usageMatch = exportStr.match(/usage:\s*["']?([^"'"]+)/i);
                            const premiumMatch = exportStr.match(/premium:\s*(true|false)/i);
                            const iconMatch = exportStr.match(/icon:\s*["']?([^"'"]+)/i);
                            const colorMatch = exportStr.match(/color:\s*["']?([^"'"]+)/i);

                            if (nameMatch) {
                                cmdName = nameMatch[1];
                                cmdDesc = descMatch ? descMatch[1] : 'No description';
                                cmdCategory = catMatch ? catMatch[1].toLowerCase() : 'utility';
                                cmdUsage = usageMatch ? usageMatch[1] : '/' + cmdName;
                                cmdPremium = premiumMatch ? premiumMatch[1] === 'true' : false;
                                cmdIcon = iconMatch ? iconMatch[1] : 'terminal';
                                cmdColor = colorMatch ? colorMatch[1] : 'blue';
                            }
                        }
                    }
                    // Pattern 3: module.exports.config = { name: "..." }
                    if (!cmdName) {
                        match = fileContent.match(/module\.exports\.config\s*=\s*{([^}]+)}/s);
                        if (match) {
                            const configStr = match[1];
                            const nameMatch = configStr.match(/name:\s*["']?([^"'"]+)/i);
                            const descMatch = configStr.match(/description:\s*["']?([^"'"]+)/i);
                            const catMatch = configStr.match(/commandCategory:\s*["']?([^"'"]+)/i) || configStr.match(/category:\s*["']?([^"'"]+)/i);
                            const usageMatch = configStr.match(/usage[s]?:\s*["']?([^"'"]+)/i);
                            const premiumMatch = configStr.match(/premium:\s*(true|false)/i);

                            if (nameMatch) {
                                cmdName = nameMatch[1];
                                cmdDesc = descMatch ? descMatch[1] : 'No description';
                                cmdCategory = catMatch ? catMatch[1].toLowerCase() : 'utility';
                                cmdUsage = usageMatch ? usageMatch[1] : '/' + cmdName;
                                cmdPremium = premiumMatch ? premiumMatch[1] === 'true' : false;
                            }
                        }
                    }

                    if (cmdName) {
                        // Get file stats - use mtime as it's more reliable on Windows
                        const fileStats = fs.statSync(commandPath);
                        // Use mtime (last modified) as the reliable date
                        const fileDate = fileStats.mtime;

                        // Format date for display
                        const formatDate = (date) => {
                            const d = new Date(date);
                            const day = d.getDate();
                            const month = d.toLocaleString('default', { month: 'short' });
                            const year = d.getFullYear();
                            return `${day} ${month} ${year}`;
                        };

                        commands.push({
                            name: cmdName,
                            description: cmdDesc,
                            category: cmdCategory || 'utility',
                            usage: cmdUsage || '/' + cmdName,
                            premium: cmdPremium || false,
                            icon: cmdIcon || 'terminal',
                            color: cmdColor || 'blue',
                            file: file,
                            createdAt: formatDate(fileDate),
                            updatedAt: formatDate(fileDate)
                        });
                    }
                } catch (err) {
                    console.log(`Error loading command ${file}:`, err.message);
                }
            }
        });

        res.json({
            success: true,
            count: commands.length,
            commands: commands
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Error reading commands folder'
        });
    }
});

// Get single command file content
app.get('/api/command/:filename', (req, res) => {
    const { filename } = req.params;
    const { download } = req.query;
    const commandsDir = path.join(__dirname, 'commands');
    const commandPath = path.join(commandsDir, filename);

    // Security check - only allow .js files in commands folder
    if (!filename.endsWith('.js') || filename.includes('..') || filename.includes('/')) {
        return res.status(400).json({
            success: false,
            message: 'Invalid file'
        });
    }

    try {
        // Check if file exists
        if (!fs.existsSync(commandPath)) {
            return res.status(404).json({
                success: false,
                message: 'Command file not found'
            });
        }

        // Read the file content
        const code = fs.readFileSync(commandPath, 'utf-8');

        // If download query is true, send file directly
        if (download === 'true') {
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', 'application/javascript');
            return res.send(code);
        }

        // Extract command info using regex (avoid require() which fails with dependencies)
        let cmdName = filename.replace('.js', '');
        let cmdDesc = 'Command';

        // Try to extract from config object
        let match = code.match(/config:\s*{[^}]*name:\s*["']?([^"']+)["']?/i);
        if (!match) {
            match = code.match(/name:\s*["']?([^"']+)["']?/i);
        }
        if (match) {
            cmdName = match[1];
        }

        match = code.match(/config:\s*{[^}]*description:\s*["']?([^"']+)["']?/i);
        if (!match) {
            match = code.match(/description:\s*["']?([^"']+)["']?/i);
        }
        if (match) {
            cmdDesc = match[1];
        }

        res.json({
            success: true,
            name: cmdName,
            description: cmdDesc,
            file: filename,
            code: code
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Error reading command file: ' + err.message
        });
    }
});

// Get commands by category
app.get('/api/commands/:category', (req, res) => {
    const { category } = req.params;
    const commandsDir = path.join(__dirname, 'commands');
    const commands = [];

    try {
        const files = fs.readdirSync(commandsDir);

        files.forEach(file => {
            if (file.endsWith('.js') && file !== 'commands.js' && file !== 'commands-data.js') {
                try {
                    const commandPath = path.join(commandsDir, file);
                    const command = require(commandPath);

                    if (command.name && command.description && command.category === category) {
                        commands.push({
                            name: command.name,
                            description: command.description,
                            category: command.category,
                            usage: command.usage || '/' + command.name,
                            premium: command.premium || false,
                            icon: command.icon || 'terminal',
                            color: command.color || 'blue'
                        });
                    }
                } catch (err) {
                    console.log(`Error loading command ${file}:`, err.message);
                }
            }
        });

        res.json({
            success: true,
            count: commands.length,
            commands: commands
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Error reading commands folder'
        });
    }
});

// ============================================
// START SERVER
// ============================================

if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`========================================`);
        console.log(`🚀 BotHub Server Running`);
        console.log(`   Local: http://localhost:${PORT}`);
        console.log(`========================================`);
    });
}

module.exports = app;
