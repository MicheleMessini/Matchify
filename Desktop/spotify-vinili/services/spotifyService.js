const axios = require('axios');
const querystring = require('querystring');

// Debug delle variabili d'ambiente all'avvio
console.log('🔧 DEBUG SPOTIFY SERVICE:');
console.log('CLIENT_ID:', process.env.SPOTIFY_CLIENT_ID ? '✅ Presente' : '❌ Mancante');
console.log('CLIENT_SECRET:', process.env.SPOTIFY_CLIENT_SECRET ? '✅ Presente' : '❌ Mancante');
console.log('REDIRECT_URI:', process.env.REDIRECT_URI ? '✅ Presente' : '❌ Mancante');

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;

/**
 * Costruisce l'URL completo per la pagina di autorizzazione di Spotify
 */
function getSpotifyAuthUrl() {
  console.log('🎵 Generando URL Spotify Auth...');
  console.log('📋 Parametri:');
  console.log('  - clientId:', clientId);
  console.log('  - redirectUri:', redirectUri);
  
  if (!clientId) {
    console.error('❌ CLIENT_ID mancante!');
    throw new Error('SPOTIFY_CLIENT_ID non configurato');
  }
  
  if (!redirectUri) {
    console.error('❌ REDIRECT_URI mancante!');
    throw new Error('REDIRECT_URI non configurato');
  }
  
  const scopes = 'playlist-read-private';
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
  });
  
  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
  console.log('🔗 URL generato:', authUrl);
  
  return authUrl;
}

/**
 * Esegue una richiesta GET generica all'API di Spotify
 */
async function makeSpotifyRequest(url, accessToken, timeout = 10000) {
  console.log(`🌐 Making request to: ${url.substring(0, 50)}...`);
  
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout
    });
    console.log('✅ Request successful');
    return response.data;
  } catch (error) {
    console.error('❌ Request failed:', error.response?.status, error.message);
    
    if (error.response?.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    if (error.response?.status === 429) {
      throw new Error('RATE_LIMITED');
    }
    throw error;
  }
}

/**
 * Scambia il code per un access token
 */
async function getAccessToken(code) {
  console.log('🔄 Scambiando code per access token...');
  console.log('📝 Code ricevuto:', code ? '✅ Presente' : '❌ Mancante');
  
  if (!clientId || !clientSecret) {
    console.error('❌ Credenziali mancanti per token exchange!');
    throw new Error('Credenziali Spotify non configurate');
  }
  
  const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  const params = querystring.stringify({
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  console.log('📤 Inviando richiesta a Spotify token endpoint...');
  
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', params, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000
    });
    
    console.log('✅ Token ricevuto con successo!');
    
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
    };
  } catch (error) {
    console.error('❌ Spotify token exchange error:', error.response?.data || error.message);
    console.error('❌ Status:', error.response?.status);
    console.error('❌ Headers inviati:', {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic [REDACTED]'
    });
    throw new Error('Errore durante lo scambio del codice per il token di accesso.');
  }
}

/**
 * Refresh access token
 */
async function refreshAccessToken(refreshToken) {
  console.log('🔄 Refreshing access token...');
  
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
    
    console.log('✅ Token refreshed successfully!');
    
    return {
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
      refresh_token: response.data.refresh_token || refreshToken 
    };
  } catch (error) {
    console.error('❌ Spotify token refresh error:', error.response?.data || error.message);
    throw new Error('Errore durante il rinnovo del token di accesso.');
  }
}

module.exports = {
    getSpotifyAuthUrl,
    makeSpotifyRequest,
    getAccessToken,
    refreshAccessToken
};
