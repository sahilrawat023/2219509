const express = require('express');
const bodyParser = require('body-parser');
const geoip = require('geoip-lite');
const dotenv = require('dotenv');
const path = require('path');

const { log, loggingMiddleware } = require('../LoggingMiddleware/loggingMiddleware.js');
const { isValidUrl, isValidShortcode } = require('../Utils/validators.js');

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(loggingMiddleware);

const urlDatabase = {};
const clickDatabase = {};

const generateShortcode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

app.post('/shorturls', (req, res) => {
  const { url, shortcode, validity = 30, accessCode } = req.body;

  if (accessCode !== process.env.ACCESS_CODE) {
    return res.status(403).json({ error: 'Invalid access code' });
  }

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL provided' });
  }

  let code = shortcode || generateShortcode();

  if (!isValidShortcode(code)) {
    return res.status(400).json({ error: 'Shortcode must be 4–20 alphanumeric characters' });
  }

  if (urlDatabase[code]) {
    return res.status(409).json({ error: 'Shortcode already exists' });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + validity * 60_000);

  urlDatabase[code] = {
    url,
    createdAt: now,
    expiresAt,
  };

  clickDatabase[code] = [];

  res.status(201).json({
    shortUrl: `${req.protocol}://${req.get('host')}/${code}`,
    expiry: expiresAt.toISOString()
  });
});

app.get('/:shortcode', (req, res) => {
  const { shortcode } = req.params;
  const entry = urlDatabase[shortcode];

  if (!entry) {
    return res.status(404).json({ error: 'Shortcode not found' });
  }

  if (Date.now() > entry.expiresAt) {
    return res.status(410).json({ error: 'Short link expired' });
  }

  const location = geoip.lookup(req.ip);

  clickDatabase[shortcode].push({
    timestamp: new Date(),
    ip: req.ip,
    country: location?.country || 'Unknown',
    region: location?.region || 'Unknown',
    referrer: req.get('Referrer') || null,
  });

  return res.redirect(entry.url);
});

app.get('/shorturls/:shortcode', (req, res) => {
  const { shortcode } = req.params;
  const entry = urlDatabase[shortcode];

  if (!entry) {
    return res.status(404).json({ error: 'Shortcode not found' });
  }

  res.json({
    url: entry.url,
    createdAt: entry.createdAt.toISOString(),
    expiresAt: entry.expiresAt.toISOString(),
    clicks: clickDatabase[shortcode]
  });
});

app.use((err, req, res, next) => {
  log(`ERROR: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => log(`Server listening on http://localhost:${PORT}`));
