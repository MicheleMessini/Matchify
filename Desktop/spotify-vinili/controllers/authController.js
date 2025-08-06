const { getAccessToken, getSpotifyAuthUrl } = require('../services/spotifyService');
const { handleError } = require('../utils/helpers');
const { renderStartPage } = require('../views/authView');

/**
 * Gestore per mostrare la pagina di login iniziale.
 * La sua unica responsabilità è inviare l'HTML generato dalla vista.
 */
const getStartPage = (req, res) => {
  const html = renderStartPage();
  res.send(html);
};

/**
 * Gestore per la rotta /login.
 * Recupera l'URL di autorizzazione da Spotify e redirige l'utente.
 */
const login = (req, res) => {
  const authUrl = getSpotifyAuthUrl();
  res.redirect(authUrl);
};

/**
 * Gestore per la rotta /callback.
 * Riceve il codice da Spotify, lo scambia per un token di accesso,
 * e salva i token nella sessione dell'utente.
 */
const handleCallback = async (req, res) => {
  const { code, error } = req.query;
  
  // 1. Controlla se Spotify ha restituito un errore
  if (error) {
    console.error('Spotify OAuth error:', error);
    return handleError(res, `Errore di autorizzazione da Spotify: ${error}`, 400);
  }
  
  // 2. Controlla se il codice di autorizzazione è presente
  if (!code) {
    return handleError(res, 'Nessun codice di autorizzazione fornito da Spotify.', 400);
  }

  // 3. Scambia il codice per i token di accesso
  try {
    const tokens = await getAccessToken(code);
    
    // Salva i token e la data di scadenza nella sessione
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token; // È buona norma salvare anche questo
    req.session.tokenExpiry = Date.now() + (tokens.expires_in * 1000);
    
    // Redirigi alla pagina principale dell'applicazione
    res.redirect('/');

  } catch (err) {
    console.error('OAuth callback token exchange error:', err);
    handleError(res, 'Errore critico durante l\'autenticazione con Spotify.');
  }
};

module.exports = {
  getStartPage,
  login,
  handleCallback,
};
