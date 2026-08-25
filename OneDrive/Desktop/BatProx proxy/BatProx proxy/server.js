require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const BOT_SECRET = process.env.BOT_SECRET || crypto.randomBytes(32).toString('hex');
const DB_PATH = './database.sqlite';

const suggestionsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const proxyCache = new Map();
const PROXY_CACHE_TTL = 2 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path.startsWith('/proxy') || req.headers['x-original-url'];
  }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many API requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  }
});

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS admin_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      user_identifier TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      approved_at DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS proxy_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      success BOOLEAN
    )`);
  });
}

app.use(helmet({
  contentSecurityPolicy: false,
  frameguard: false
}));

app.use(cors({
  origin: ['http://localhost:5179', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177', 'http://localhost:5178', 'http://localhost:5180'],
  credentials: true
}));

app.use(express.static('public'));

app.use(limiter);
app.use(express.json());
app.use('/api/', apiLimiter);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

app.post('/api/suggestions', async (req, res) => {
  try {
    const { content, userIdentifier } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Suggestion content is required' });
    }

    if (content.length > 1000) {
      return res.status(400).json({ error: 'Suggestion content is too long (max 1000 characters)' });
    }

    const sanitizedContent = content.trim().replace(/[<>]/g, '');
    const identifier = userIdentifier || 'anonymous-' + Date.now();

    db.run(
      'INSERT INTO user_suggestions (content, user_identifier) VALUES (?, ?)',
      [sanitizedContent, identifier],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to save suggestion' });
        }
        res.json({ 
          success: true, 
          message: 'Suggestion submitted successfully',
          id: this.lastID,
          userIdentifier: identifier
        });
      }
    );
  } catch (error) {
    console.error('Suggestion submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.all('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).send('URL parameter is required');
  }

  try {
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      return res.status(400).send('Invalid URL format');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).send('Only HTTP and HTTPS protocols are allowed');
    }

    const isServiceWorkerRequest = req.headers['x-proxy-request'] === 'true';
    const originalUrl = req.headers['x-original-url'];
    const originalOrigin = req.headers['x-original-origin'];
    const originalHost = req.headers['x-original-host'];

    const response = await axios({
      method: req.method,
      url: targetUrl,
      responseType: isServiceWorkerRequest ? 'arraybuffer' : 'text',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': req.headers['accept'] || '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': originalOrigin || parsedUrl.origin,
        'Origin': originalOrigin || parsedUrl.origin,
        'Host': originalHost || parsedUrl.hostname
      },
      data: req.body,
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: () => true
    });
    
    if (isServiceWorkerRequest && response.data instanceof ArrayBuffer) {
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      res.set('Content-Type', contentType);
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.set('Access-Control-Allow-Headers', '*');
      res.set('X-Proxy-Response', 'true');
      return res.send(Buffer.from(response.data));
    }
    
    let html = response.data;
    const origin = parsedUrl.origin;
    
    if (typeof html === 'string') {
      html = html.replace(/(src|href|action|background|cite)="\/([^"]*)"/g, `$1="${origin}/$2"`);
      html = html.replace(/url\(['"]?\/([^'"]*)['"]?\)/g, `url('${origin}/$1')`);
      html = html.replace(/(src|href|action|background|cite)="([^"]+)"/g, (match, attr, url) => {
        if (!url.startsWith('http') && !url.startsWith('//') && !url.startsWith('data:')) {
          return `${attr}="${origin}/${url}"`;
        }
        return match;
      });
    }
    
    const contentType = response.headers['content-type'] || 'text/html';
    res.set('Content-Type', contentType);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', '*');
    res.set('X-Proxy-Response', 'true');
    
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');
    
    res.send(html);
  } catch (error) {
    console.error('Proxy error:', error.message);
    if (error.response) {
      res.status(error.response.status).send(`Proxy error: ${error.response.statusText}`);
    } else if (error.request) {
      res.status(502).send('Proxy error: No response from target server');
    } else {
      res.status(500).send(`Proxy error: ${error.message}`);
    }
  }
});

app.options('*', (req, res) => {
  const requestOrigin = req.headers['origin'];
  if (requestOrigin) {
    res.set('Access-Control-Allow-Origin', requestOrigin);
  } else {
    res.set('Access-Control-Allow-Origin', '*');
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', '*');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Max-Age', '86400');
  res.status(204).send();
});

function getCacheKey(url, method) {
  return `${method}:${url}`;
}

function cleanCache() {
  const now = Date.now();
  for (const [key, value] of proxyCache.entries()) {
    if (now - value.timestamp > PROXY_CACHE_TTL) {
      proxyCache.delete(key);
    }
  }
  if (proxyCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(proxyCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, proxyCache.size - MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
      proxyCache.delete(key);
    }
  }
}

setInterval(cleanCache, 30000);

async function proxyRequest(targetUrl, req, res) {
  try {
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      return res.status(400).send('Invalid URL format');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).send('Only HTTP and HTTPS protocols are allowed');
    }

    const originalOrigin = req.headers['x-original-origin'];
    const originalHost = req.headers['x-original-host'];

    const cacheKey = getCacheKey(targetUrl, req.method);
    if (req.method === 'GET') {
      const cached = proxyCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PROXY_CACHE_TTL) {
        res.set('Content-Type', cached.contentType);
        
        const requestOrigin = req.headers['origin'];
        if (requestOrigin) {
          res.set('Access-Control-Allow-Origin', requestOrigin);
        } else {
          res.set('Access-Control-Allow-Origin', '*');
        }
        
        res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.set('Access-Control-Allow-Headers', '*');
        res.set('X-Proxy-Response', 'true');
        res.set('X-Cache', 'HIT');
        return res.send(cached.data);
      }
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      responseType: 'arraybuffer',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': req.headers['accept'] || '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'Referer': originalOrigin || parsedUrl.origin,
        'Origin': originalOrigin || parsedUrl.origin,
        'Host': originalHost || parsedUrl.hostname
      },
      data: req.body,
      timeout: 8000,
      maxRedirects: 5,
      validateStatus: () => true,
      httpAgent: new (require('http').Agent)({ keepAlive: true, maxSockets: 50, maxFreeSockets: 10 }),
      httpsAgent: new (require('https').Agent)({ keepAlive: true, maxSockets: 50, maxFreeSockets: 10 })
    });
    
    const contentType = response.headers['content-type'] || 'application/json';
    let responseData = response.data;
    
    const isBinary = contentType.includes('font') || 
                     contentType.includes('image') || 
                     contentType.includes('video') || 
                     contentType.includes('audio') || 
                     contentType.includes('application/octet-stream') ||
                     contentType.includes('application/zip') ||
                     contentType.includes('application/pdf') ||
                     contentType.includes('woff') ||
                     contentType.includes('woff2') ||
                     contentType.includes('ttf') ||
                     contentType.includes('otf') ||
                     contentType.includes('eot');
    
    if (response.data instanceof ArrayBuffer || Buffer.isBuffer(response.data)) {
      if (isBinary) {
        responseData = Buffer.from(response.data);
      } else if (contentType.includes('text') || contentType.includes('json') || contentType.includes('javascript') || contentType.includes('xml') || contentType.includes('html') || contentType.includes('css')) {
        try {
          responseData = Buffer.from(response.data).toString('utf-8');
        } catch (e) {
          responseData = Buffer.from(response.data);
        }
      } else {
        responseData = Buffer.from(response.data);
      }
    }
    
    if (req.method === 'GET' && response.status === 200 && responseData && typeof responseData === 'string' && !isBinary) {
      proxyCache.set(cacheKey, {
        data: responseData,
        contentType: contentType,
        timestamp: Date.now()
      });
    }
    
    if (contentType.includes('javascript') || contentType.includes('json') || contentType.includes('application/json')) {
      res.set('Content-Type', 'application/javascript; charset=utf-8');
    } else {
      res.set('Content-Type', contentType);
    }
    
    const requestOrigin = req.headers['origin'];
    if (requestOrigin) {
      res.set('Access-Control-Allow-Origin', requestOrigin);
    } else {
      res.set('Access-Control-Allow-Origin', '*');
    }
    
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Expose-Headers', '*');
    res.set('X-Proxy-Response', 'true');
    res.set('X-Cache', 'MISS');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');
    res.removeHeader('X-Content-Type-Options');
    res.removeHeader('Frame-Options');
    res.removeHeader('Frame-Ancestors');
    res.removeHeader('Content-Security-Policy-Report-Only');
    res.removeHeader('Permissions-Policy');
    
    if (Buffer.isBuffer(responseData)) {
      res.send(responseData);
    } else {
      res.send(responseData);
    }
  } catch (error) {
    console.error('Proxy error:', error.message);
    if (error.response) {
      res.status(error.response.status).send(`Proxy error: ${error.response.statusText}`);
    } else if (error.request) {
      res.status(502).send('Proxy error: No response from target server');
    } else {
      res.status(500).send(`Proxy error: ${error.message}`);
    }
  }
}

app.all('/ajax/*', async (req, res, next) => {
  const originalUrl = req.headers['x-original-url'];
  
  if (!originalUrl) {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-original-host'] || 'www.instagram.com';
    const pathname = req.path;
    const search = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const constructedUrl = `${protocol}://${host}${pathname}${search}`;
    
    return proxyRequest(constructedUrl, req, res);
  }
  
  return proxyRequest(originalUrl, req, res);
});

app.all('/api/*', async (req, res, next) => {
  const originalUrl = req.headers['x-original-url'];
  
  if (!originalUrl) {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-original-host'] || 'www.instagram.com';
    const pathname = req.path;
    const search = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const constructedUrl = `${protocol}://${host}${pathname}${search}`;
    
    return proxyRequest(constructedUrl, req, res);
  }
  
  return proxyRequest(originalUrl, req, res);
});

app.all('/ig_xsite_user_info*', async (req, res, next) => {
  const originalUrl = req.headers['x-original-url'];
  
  if (!originalUrl) {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-original-host'] || 'www.facebook.com';
    const pathname = req.path;
    const search = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const constructedUrl = `${protocol}://${host}${pathname}${search}`;
    
    return proxyRequest(constructedUrl, req, res);
  }
  
  return proxyRequest(originalUrl, req, res);
});

app.all('/v1/*', async (req, res, next) => {
  const originalUrl = req.headers['x-original-url'];
  
  if (!originalUrl) {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-original-host'] || 'apis.roblox.com';
    const pathname = req.path;
    const search = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const constructedUrl = `${protocol}://${host}${pathname}${search}`;
    
    return proxyRequest(constructedUrl, req, res);
  }
  
  return proxyRequest(originalUrl, req, res);
});

app.all('/v2/*', async (req, res, next) => {
  const originalUrl = req.headers['x-original-url'];
  
  if (!originalUrl) {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-original-host'] || 'auth.roblox.com';
    const pathname = req.path;
    const search = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const constructedUrl = `${protocol}://${host}${pathname}${search}`;
    
    return proxyRequest(constructedUrl, req, res);
  }
  
  return proxyRequest(originalUrl, req, res);
});

app.all('/cdn-cgi/*', async (req, res, next) => {
  const originalUrl = req.headers['x-original-url'];
  
  if (!originalUrl) {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-original-host'] || 'challenges.cloudflare.com';
    const pathname = req.path;
    const search = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const constructedUrl = `${protocol}://${host}${pathname}${search}`;
    
    return proxyRequest(constructedUrl, req, res);
  }
  
  return proxyRequest(originalUrl, req, res);
});

app.all('*', async (req, res, next) => {
  const originalUrl = req.headers['x-original-url'];
  
  if (!originalUrl) {
    return next();
  }

  try {
    let parsedUrl;
    try {
      parsedUrl = new URL(originalUrl);
    } catch (e) {
      return res.status(400).send('Invalid URL format');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).send('Only HTTP and HTTPS protocols are allowed');
    }

    const response = await axios({
      method: req.method,
      url: originalUrl,
      responseType: 'arraybuffer',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': req.headers['accept'] || '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': parsedUrl.origin,
        'Origin': parsedUrl.origin
      },
      data: req.body,
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: () => true
    });
    
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    res.set('Content-Type', contentType);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', '*');
    res.set('X-Proxy-Response', 'true');
    
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');
    
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Dynamic proxy error:', error.message);
    if (error.response) {
      res.status(error.response.status).send(`Proxy error: ${error.response.statusText}`);
    } else if (error.request) {
      res.status(502).send('Proxy error: No response from target server');
    } else {
      res.status(500).send(`Proxy error: ${error.message}`);
    }
  }
});

app.get('/api/admin/feedbacks', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM user_suggestions ORDER BY submitted_at DESC',
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to retrieve feedbacks' });
      }
      res.json({ feedbacks: rows });
    }
  );
});

app.post('/api/admin/approve-feedback', authenticateToken, (req, res) => {
  const { suggestionId } = req.body;
  
  if (!suggestionId) {
    return res.status(400).json({ error: 'Suggestion ID is required' });
  }

  db.run(
    'UPDATE user_suggestions SET status = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['approved', suggestionId],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to approve suggestion' });
      }
      res.json({ success: true, message: 'Suggestion approved successfully' });
    }
  );
});

app.get('/api/suggestions/:userIdentifier', (req, res) => {
  const { userIdentifier } = req.params;
  
  const cached = suggestionsCache.get(userIdentifier);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.json({ notifications: cached.data });
  }
  
  db.all(
    'SELECT * FROM user_suggestions WHERE user_identifier = ? AND status = ? ORDER BY approved_at DESC LIMIT 5',
    [userIdentifier, 'approved'],
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to retrieve notifications' });
      }
      
      suggestionsCache.set(userIdentifier, {
        data: rows,
        timestamp: Date.now()
      });
      
      res.json({ notifications: rows });
    }
  );
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    db.get(
      'SELECT * FROM admin_accounts WHERE username = ?',
      [username],
      async (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (!row) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, row.password_hash);
        
        if (!validPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
          { id: row.id, username: row.username },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({ 
          success: true, 
          token,
          user: { id: row.id, username: row.username }
        });
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/create-account', async (req, res) => {
  try {
    const { username, password, botSecret } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (!botSecret || botSecret !== BOT_SECRET) {
      return res.status(403).json({ error: 'Invalid bot secret' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    db.run(
      'INSERT INTO admin_accounts (username, password_hash) VALUES (?, ?)',
      [username, passwordHash],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint')) {
            return res.status(409).json({ error: 'Username already exists' });
          }
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to create account' });
        }
        res.json({ 
          success: true, 
          message: 'Account created successfully',
          id: this.lastID 
        });
      }
    );
  } catch (error) {
    console.error('Account creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use('/proxy', (req, res, next) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const url = new URL(targetUrl);
    
    if (!['http:', 'https:'].includes(url.protocol)) {
      return res.status(400).json({ error: 'Only HTTP and HTTPS protocols are allowed' });
    }

    const proxyOptions = {
      target: targetUrl,
      changeOrigin: true,
      secure: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('X-Forwarded-For', req.ip);
        proxyReq.setHeader('X-Real-IP', req.ip);
      },
      onProxyRes: (proxyRes, req, res) => {
        proxyRes.headers['X-Frame-Options'] = 'ALLOWALL';
        proxyRes.headers['Content-Security-Policy'] = "frame-ancestors 'self' *;";
        delete proxyRes.headers['x-frame-options'];
        delete proxyRes.headers['content-security-policy'];
      },
      selfHandleResponse: false
    };

    const proxy = createProxyMiddleware(proxyOptions);
    proxy(req, res, next);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error: ' + error.message });
  }
});

app.post('/api/ai/chat', upload.array('images', 10), async (req, res) => {
  try {
    let message = '';
    
    if (req.body.message) {
      message = req.body.message;
    }
    
    const files = req.files;
    if (!message && (!files || files.length === 0)) {
      return res.status(400).json({ error: 'Message or image is required' });
    }

    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('who made this website') || lowerMessage.includes('who created this website') || lowerMessage.includes('who made this site')) {
      return res.json({ 
        response: 'MicahG, is the creator of this website. And the creator of me. He is going to keep on improving me, and going to keep on improving this entire website in general.' 
      });
    }

    let imageCount = files ? files.length : 0;

    let userContent = message;
    if (imageCount > 0) {
      userContent = `[User attached ${imageCount} image(s). Note: I cannot view images directly, but I can help you describe or analyze them if you provide details.] ${message}`;
    }

    const response = await fetch('http://127.0.0.1:11434/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.1:8b',
        messages: [
          { role: 'system', content: 'You are MocahAI, a highly intelligent AI assistant created by MicahG. You are knowledgeable in algebra 1, algebra 2, geometry 1, geometry 2, physics, chemistry, biology, science, english, history, geography, computer science, calculus, statistics, trigonometry, literature, writing, and many other academic subjects. Provide accurate, detailed, and helpful responses. Be thorough but concise. Use markdown formatting when appropriate with **bold** for emphasis and *italic* for important terms.' },
          { role: 'user', content: userContent }
        ],
        stream: false,
        max_tokens: 800,
        temperature: 0.6
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Forge API error:', errorText);
      return res.status(500).json({ error: 'Failed to get AI response' });
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || 'No response from AI';

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/ai/status/api', (req, res) => {
  res.send('MochaAI active');
});

app.get('/api/my-games', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const gamesDir = path.join(__dirname, 'public', 'my-games');
  
  try {
    if (!fs.existsSync(gamesDir)) {
      return res.json({ games: [] });
    }
    
    const files = fs.readdirSync(gamesDir);
    const games = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.html', '.htm', '.swf', '.zip'].includes(ext);
      })
      .map(file => ({
        name: path.basename(file, path.extname(file)),
        filename: file,
        url: `/my-games/${file}`
      }));
    
    res.json({ games });
  } catch (error) {
    console.error('Error reading my-games directory:', error);
    res.status(500).json({ error: 'Failed to read games directory' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Proxy endpoint: http://localhost:${PORT}/proxy?url=<target_url>`);
});
