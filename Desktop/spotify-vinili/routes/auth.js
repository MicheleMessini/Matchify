const express = require('express');
const { getAccessToken, getSpotifyAuthUrl } = require('../services/spotifyService');
const { handleError } = require('../utils/helpers');
const router = express.Router();

// Pagina iniziale
router.get('/start', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Matchify - Home</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body>
        <div class="container">
          <h1>Matchify</h1>
          <div style="text-align:center; margin-top: 2rem;">
            <a href="/login" class="btn btn-primary">Accedi con Spotify</a>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Avvia il processo di login con Spotify
router.get('/login', (req, res) => {
  const authUrl = getSpotifyAuthUrl();
  res.redirect(authUrl);
});

// Callback di Spotify dopo il login
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    console.error('OAuth error:', error);
    return handleError(res, `Errore di autorizzazione: ${error}`, 400);
  }
  
  if (!code) {
    return handleError(res, 'Nessun codice di autorizzazione fornito', 400);
  }

  try {
    const tokens = await getAccessToken(code);
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token; // Salva anche il refresh token
    req.session.tokenExpiry = Date.now() + (tokens.expires_in * 1000);
    
    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error:', err);
    handleError(res, 'Errore durante l\'autenticazione con Spotify');
  }
});

module.exports = router;
