const axios = require('axios');
const querystring = require('querystring');

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;

// Utility per generare l'URL di autorizzazione
function getSpotifyAuthUrl() {
  const scopes = 'playlist-read-private';
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

// Funzione generica per le richieste a Spotify
async function makeSpotifyRequest(url, accessToken, timeout = 10000) {
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    if (error.response?.status === 429) {
      throw new Error('RATE_LIMITED');
    }
    throw error;
  }
}

// Ottenere il token di accesso la prima volta
async function getAccessToken(code) {
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const params = querystring.stringify({
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', params, {
      headers: {
        Authorization: `Basic ${authHeader}`,
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
    console.error('Token exchange error:', error.response?.data || error.message);
    throw new Error('Errore ottenendo token di accesso');
  }
}

// Funzione per rinfrescare il token (non usata attivamente nel tuo codice ma buona da tenere)
async function refreshAccessToken(refreshToken) {
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const params = querystring.stringify({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', params, {
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000
    });
    
    return {
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
    };
  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    throw new Error('Errore rinfrescando token');
  }
}


module.exports = {
    getSpotifyAuthUrl,
    makeSpotifyRequest,
    getAccessToken,
    refreshAccessToken
};
