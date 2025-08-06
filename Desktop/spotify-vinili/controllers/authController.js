const { getAccessToken, getSpotifyAuthUrl } = require('../services/spotifyService');
const { handleError } = require('../utils/helpers');
const { renderStartPage } = require('../views/authView');

/**
 * Gestore per la rotta /start.
 * Mostra la pagina di login iniziale generata dalla vista.
 * @param {object} req - L'oggetto richiesta di Express.
 * @param {object} res - L'oggetto risposta di Express.
 */
const getStartPage = (req, res) => {
  const html = renderStartPage();
  res.send(html);
};

/**
 * Gestore per la rotta /login.
 * Recupera l'URL di autorizzazione di Spotify e reindirizza l'utente.
 * @param {object} req - L'oggetto richiesta di Express.
 * @param {object} res - L'oggetto risposta di Express.
 */
const login = (req, res) => {
  const authUrl = getSpotifyAuthUrl();
  res.redirect(authUrl);
};

/**
 * Gestore per la rotta /callback.
 * Questa è la funzione più critica del flusso di autenticazione.
 * 1. Riceve il codice di autorizzazione da Spotify.
 * 2. Lo scambia con un token di accesso chiamando il spotifyService.
 * 3. Se lo scambio ha successo, salva i token nella sessione e reindirizza all'app.
 * 4. Se lo scambio fallisce, mostra una pagina di errore.
 * @param {object} req - L'oggetto richiesta di Express, contenente 'code' e 'error' nei query params.
 * @param {object} res - L'oggetto risposta di Express.
 */
const handleCallback = async (req, res) => {
  const { code, error } = req.query;
  
  // 1. Controllo primario: Spotify ha restituito un errore esplicito? (es. l'utente ha negato l'accesso)
  if (error) {
    console.error('Spotify OAuth error (es. accesso negato):', error);
    return handleError(res, `Errore di autorizzazione restituito da Spotify: ${error}`, 400);
  }
  
  // 2. Controllo di sanità: Il codice di autorizzazione è presente?
  if (!code) {
    return handleError(res, 'Nessun codice di autorizzazione valido fornito da Spotify.', 400);
  }

  // 3. Blocco critico: tenta di scambiare il codice per un token di accesso.
  // Questo blocco può fallire per errori di configurazione (es. Redirect URI o Client Secret sbagliati).
  try {
    const tokens = await getAccessToken(code);
    
    // Se lo scambio ha successo, salva i token e la data di scadenza nella sessione dell'utente.
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token; // Utile per rinnovare il token in futuro
    req.session.tokenExpiry = Date.now() + (tokens.expires_in * 1000);
    
    // Reindirizza alla pagina principale dell'applicazione, il login è completato!
    res.redirect('/');

  } catch (err) {
    // SE ENTRIAMO QUI, lo scambio è fallito. Dobbiamo capire perché.
    
    // Logga l'errore completo restituito da Spotify/Axios per un debug efficace.
    // Cerca questo messaggio nei log del tuo servizio di hosting (Render).
    console.error('ERRORE DETTAGLIATO NELLO SCAMBIO DEL TOKEN:', err.response?.data || err.message);
    
    // Mostra una pagina di errore generica all'utente.
    handleError(res, 'Errore critico durante la finalizzazione dell\'autenticazione con Spotify. Controlla la configurazione.');
  }
};

// Esporta tutte le funzioni per renderle disponibili al router (authRoutes.js).
module.exports = {
  getStartPage,
  login,
  handleCallback,
};
