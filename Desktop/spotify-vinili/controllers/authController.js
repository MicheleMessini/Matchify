const { getAccessToken, getSpotifyAuthUrl } = require('../services/spotifyService');
const { handleError } = require('../utils/helpers');
const { renderStartPage } = require('../views/authView');

/**
 * Gestore per la rotta /start.
 */
const getStartPage = (req, res) => {
  console.log('🏠 GET /start chiamato');
  const html = renderStartPage();
  res.send(html);
};

/**
 * Gestore per la rotta /login.
 */
const login = (req, res) => {
  console.log('🚀 LOGIN CHIAMATO!');
  
  try {
    const authUrl = getSpotifyAuthUrl();
    console.log('🔗 Auth URL generato:', authUrl);
    
    if (!authUrl || !authUrl.startsWith('https://accounts.spotify.com')) {
      return handleError(res, 'Configurazione OAuth non valida');
    }
    
    console.log('🔄 Redirecting to Spotify...');
    res.redirect(authUrl);
    
  } catch (error) {
    handleError(res, 'Errore nella configurazione dell\'autenticazione');
  }
};

/**
 * Gestore per la rotta /callback.
 */
const handleCallback = async (req, res) => {
  console.log('📞 CALLBACK RICEVUTO!');
  
  const { code, error } = req.query;
  
  if (error) {
    return handleError(res, `Errore di autorizzazione: ${error}`, 400);
  }
  
  if (!code) {
    return handleError(res, 'Nessun codice di autorizzazione valido.', 400);
  }
  
  console.log('✅ Codice ricevuto, tentativo di scambio token...');
  
  try {
    const tokens = await getAccessToken(code);
    
    // --- AGGIUNTA FONDAMENTALE PER IL DEBUG ---
    // Stampa il token di accesso direttamente nei log del server.
    // Dopo il login, dovrai copiare questa stringa dai log di Render.
    console.log('!!!!!!!!!! TOKEN DI ACCESSO DA COPIARE !!!!!!!!!!!');
    console.log(tokens.access_token);
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    // --- FINE AGGIUNTA ---
    
    // Salva in sessione
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token;
    req.session.tokenExpiry = Date.now() + (tokens.expires_in * 1000);
    
    console.log('✅ Sessione salvata, redirect a /');
    res.redirect('/');
    
  } catch (err) {
    handleError(res, 'Errore durante l\'autenticazione con Spotify.');
  }
};

module.exports = {
  getStartPage,
  login,
  handleCallback,
};
