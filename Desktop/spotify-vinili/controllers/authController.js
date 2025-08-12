const { getAccessToken, getSpotifyAuthUrl } = require('../services/spotifyService');
const { handleError } = require('../utils/helpers');
const { renderStartPage } = require('../views/authView');

/**
 * Gestore per la rotta /start.
 * Mostra la pagina di login iniziale generata dalla vista.
 */
const getStartPage = (req, res) => {
  console.log('🏠 GET /start chiamato');
  const html = renderStartPage();
  res.send(html);
};

/**
 * Gestore per la rotta /login.
 * Recupera l'URL di autorizzazione di Spotify e reindirizza l'utente.
 */
const login = (req, res) => {
  console.log('🚀 LOGIN CHIAMATO!');
  
  try {
    const authUrl = getSpotifyAuthUrl();
    console.log('🔗 Auth URL generato:', authUrl);
    
    // Controlla se l'URL è valido
    if (!authUrl || !authUrl.startsWith('https://accounts.spotify.com')) {
      console.error('❌ URL di autorizzazione non valido:', authUrl);
      return handleError(res, 'Configurazione OAuth non valida');
    }
    
    console.log('🔄 Redirecting to Spotify...');
    res.redirect(authUrl);
    
  } catch (error) {
    console.error('❌ Errore nella generazione dell\'URL auth:', error);
    handleError(res, 'Errore nella configurazione dell\'autenticazione');
  }
};

/**
 * Gestore per la rotta /callback.
 */
const handleCallback = async (req, res) => {
  console.log('📞 CALLBACK RICEVUTO!');
  console.log('📝 Query params:', req.query);
  
  const { code, error } = req.query;
  
  // 1. Controllo errori Spotify
  if (error) {
    console.error('❌ Spotify OAuth error:', error);
    return handleError(res, `Errore di autorizzazione: ${error}`, 400);
  }
  
  // 2. Controllo codice
  if (!code) {
    console.error('❌ Nessun codice di autorizzazione ricevuto');
    return handleError(res, 'Nessun codice di autorizzazione valido.', 400);
  }
  
  console.log('✅ Codice ricevuto, tentativo di scambio token...');
  
  // 3. Scambio token
  try {
    const tokens = await getAccessToken(code);
    console.log('✅ Token ricevuti con successo!');
    
    // Salva in sessione
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token;
    req.session.tokenExpiry = Date.now() + (tokens.expires_in * 1000);
    
    console.log('✅ Sessione salvata, redirect a /');
    res.redirect('/');
    
  } catch (err) {
    console.error('❌ ERRORE SCAMBIO TOKEN:', err.response?.data || err.message);
    console.error('❌ Stack completo:', err);
    handleError(res, 'Errore durante l\'autenticazione con Spotify.');
  }
};

module.exports = {
  getStartPage,
  login,
  handleCallback,
};
