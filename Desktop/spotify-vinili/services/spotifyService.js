const axios = require('axios');
const querystring = require('querystring'); // Nativo di Node.js

// Le credenziali vengono lette dalle variabili d'ambiente per sicurezza
const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;

/**
 * Costruisce l'URL completo per la pagina di autorizzazione di Spotify
 * a cui l'utente deve essere reindirizzato.
 * @returns {string} - L'URL di autorizzazione.
 */
function getSpotifyAuthUrl() {
  const scopes = 'playlist-read-private'; // Definisce i permessi che la tua app richiede
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Esegue una richiesta GET generica all'API di Spotify, aggiungendo l'header
 * di autorizzazione necessario. Gestisce anche gli errori comuni.
 * @param {string} url - L'URL completo dell'endpoint API di Spotify.
 * @param {string} accessToken - Il token di accesso dell'utente.
 * @param {number} [timeout=10000] - Timeout in millisecondi per la richiesta.
 * @returns {Promise<object>} - I dati (data) dalla risposta dell'API.
 * @throws {Error} - Lancia un errore specifico per status code 401 e 429.
 */
async function makeSpotifyRequest(url, accessToken, timeout = 10000) {
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      // Token non valido o scaduto. Il controller dovrà gestire questo errore.
      throw new Error('UNAUTHORIZED');
    }
    if (error.response?.status === 429) {
      // L'applicazione ha superato il limite di richieste.
      throw new Error('RATE_LIMITED');
    }
    // Per tutti gli altri errori, lancia l'errore originale.
    throw error;
  }
}

/**
 * Scambia il "code" ottenuto dal callback di Spotify per un token di accesso
 * e un refresh token, utilizzando il grant type "authorization_code".
 * @param {string} code - Il codice di autorizzazione fornito da Spotify nel callback.
 * @returns {Promise<object>} - Un oggetto contenente access_token, refresh_token e expires_in.
 */
async function getAccessToken(code) {
  const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  const params = querystring.stringify({
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', params, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000
    });
    
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
    };
  } catch (error) {
    console.error('Spotify token exchange error:', error.response?.data || error.message);
    throw new Error('Errore durante lo scambio del codice per il token di accesso.');
  }
}

/**
 * Usa un refresh token per ottenere un nuovo access token senza richiedere
 * all'utente di effettuare nuovamente il login.
 * @param {string} refreshToken - Il refresh token salvato.
 * @returns {Promise<object>} - Un oggetto contenente il nuovo access_token e expires_in.
 */
async function refreshAccessToken(refreshToken) {
  const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  const params = querystring.stringify({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', params, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000
    });
    
    return {
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
      // Nota: Spotify potrebbe restituire un nuovo refresh token in alcuni flussi
      refresh_token: response.data.refresh_token || refreshToken 
    };
  } catch (error) {
    console.error('Spotify token refresh error:', error.response?.data || error.message);
    throw new Error('Errore durante il rinnovo del token di accesso.');
  }
}

module.exports = {
    getSpotifyAuthUrl,
    makeSpotifyRequest,
    getAccessToken,
    refreshAccessToken
};
