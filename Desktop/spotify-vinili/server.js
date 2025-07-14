require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');

// Importa le rotte
const authRoutes = require('./routes/auth');
const appRoutes = require('./routes/app');

const app = express();
const port = process.env.PORT || 3000;

// Variabili ambiente obbligatorie
const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, REDIRECT_URI, SESSION_SECRET } = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !REDIRECT_URI) {
  console.error("⚠️  Configurare SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET e REDIRECT_URI nel file .env!");
  process.exit(1);
}

// Configurazione middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 3600000, sameSite: 'lax' }
}));

// Middleware per la gestione dell'autenticazione
const requireAuth = (req, res, next) => {
  // Le rotte pubbliche non hanno bisogno di questo controllo
  if (!req.session.accessToken) {
    return res.redirect('/start');
  }
  // Qui si potrebbe aggiungere logica per rinfrescare il token se scaduto
  next();
};

// Route per il check dello stato del server
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Usa le rotte di autenticazione (non richiedono il login)
app.use('/', authRoutes);

// Da qui in poi, tutte le rotte richiederanno l'autenticazione
app.use('/', requireAuth, appRoutes);

app.listen(port, () => {
  console.log(`🚀 Server in ascolto sulla porta ${port}`);
});
