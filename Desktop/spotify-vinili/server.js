require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
const querystring = require('querystring');

const app = express();
const port = process.env.PORT || 3000;

// Funzione per escape HTML (contro XSS)
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Variabili ambiente obbligatorie
const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;

if (!clientId || !clientSecret || !redirectUri) {
  console.error("⚠️  Configurare SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET e REDIRECT_URI nel file .env!");
  process.exit(1);
}

// Configurazione middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 3600000, sameSite: 'lax' }
}));

function handleError(res, message, status = 500) {
  const escapedMessage = escapeHtml(message);

  const html = `
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Errore</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <div class="container">
          <h2>❌ Errore</h2>
          <p>${escapedMessage}</p>
          <a href="/start" class="btn btn-secondary">Torna alla home</a>
        </div>
      </body>
    </html>
  `;

  res.status(status).send(html);
}
// Spotify API utilities
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

// Authentication middleware
function requireAuth(req, res, next) {
  const publicPaths = ['/start', '/login', '/callback'];
  if (publicPaths.includes(req.path)) return next();
  
  if (!req.session.accessToken) {
    return res.redirect('/start');
  }
  next();
}

// Routes
app.get('/start', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Benvenuto</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body>
        <div class="container">
          <h1>Spotify Playlist Analyzer</h1>
          <div style="text-align:center;">
            <a href="/login" class="btn btn-primary">Accedi con Spotify</a>
          </div>
        </div>
      </body>
    </html>
  `);
});

app.get('/login', (req, res) => {
  const authUrl = getSpotifyAuthUrl();
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return handleError(res, `Errore di autorizzazione: ${error}`, 400);
  }
  
  if (!code) {
    return handleError(res, 'Nessun codice di autorizzazione fornito', 400);
  }

  try {
    const tokens = await getAccessToken(code);
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token;
    req.session.tokenExpiry = Date.now() + (tokens.expires_in * 1000);
    
    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error:', err);
    handleError(res, 'Errore durante l\'autenticazione con Spotify');
  }
});

// Protect all subsequent routes
app.use(requireAuth);

// Main playlist view
app.get('/', async (req, res) => {
  const accessToken = req.session.accessToken;
  
  try {
    // Get all user playlists
    let playlists = [];
    let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=50';

    while (nextUrl) {
      const response = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000
      });
      playlists.push(...response.data.items);
      nextUrl = response.data.next;
    }

    // Sort by track count (descending)
    playlists.sort((a, b) => b.tracks.total - a.tracks.total);

    // Pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = 6;
    const totalPages = Math.ceil(playlists.length / perPage);
    const paginatedPlaylists = playlists.slice((page - 1) * perPage, page * perPage);

    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Le tue Playlist Spotify</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body>
        <div class="container">
          <h1>Le tue Playlist Spotify</h1>
          
          <div class="row">
            ${paginatedPlaylists.map(playlist => `
              <div class="col-md-4">
                <div class="card">
                  <a href="/playlist/${escapeHtml(playlist.id)}" class="card-link">
                    <img src="${escapeHtml(playlist.images?.[0]?.url || '/placeholder.png')}" 
                         alt="${escapeHtml(playlist.name)}" 
                         class="card-img-top"
                         onerror="this.src='/placeholder.png'">
                    <div class="card-body">
                      <h5 class="card-title">${escapeHtml(playlist.name)}</h5>
                    </div>
                  </a>
                </div>
              </div>
            `).join('')}
          </div>
          
          ${totalPages > 1 ? `
            <div class="pagination">
              ${page > 1 ? `<a href="/?page=${page - 1}" class="btn btn-primary">« Precedente</a>` : ''}
              <span class="page-info">Pagina ${page} di ${totalPages}</span>
              ${page < totalPages ? `<a href="/?page=${page + 1}" class="btn btn-primary">Successivo »</a>` : ''}
            </div>
          ` : ''}
          
          <div class="text-center mt-4">
            <a href="/logout" class="btn btn-secondary">Logout</a>
          </div>
        </div>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (err) {
    console.error('Error fetching playlists:', err.message);
    if (err.response?.status === 401) {
      req.session.destroy();
      return res.redirect('/start');
    }
    handleError(res, 'Impossibile recuperare le playlist. Riprova più tardi.');
  }
});

// Playlist detail view
app.get('/playlist/:id', async (req, res) => {
  const accessToken = req.session.accessToken;
  const playlistId = req.params.id;
  const view = req.query.view || 'album';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const perPage = 15;

  try {
    // Get playlist info
    const playlistRes = await axios.get(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000
    });
    const playlist = playlistRes.data;

    // Get all tracks
    let tracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=50`;
    
    while (nextUrl) {
      const trackRes = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000
      });
      tracks.push(...trackRes.data.items);
      nextUrl = trackRes.data.next;
    }

    let contentHtml = '';

    if (view === 'artist') {
      // Artist view
      const artistsMap = new Map();

      tracks.forEach(item => {
        const track = item?.track;
        if (!track?.artists) return;
        
        track.artists.forEach(artist => {
          if (!artist?.id) return;
          if (!artistsMap.has(artist.id)) {
            artistsMap.set(artist.id, {
              id: artist.id,
              name: artist.name || 'Sconosciuto',
              trackCount: 0
            });
          }
          artistsMap.get(artist.id).trackCount++;
        });
      });

      // Get artist details in batches
      const artistIds = Array.from(artistsMap.keys());
      const artistImages = new Map();
      
      for (let i = 0; i < artistIds.length; i += 50) {
        const chunk = artistIds.slice(i, i + 50);
        try {
          const response = await axios.get(`https://api.spotify.com/v1/artists?ids=${chunk.join(',')}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000
          });
          response.data.artists.forEach(artist => {
            if (artist) {
              artistImages.set(artist.id, artist.images?.[0]?.url || '/placeholder.png');
            }
          });
        } catch (err) {
          console.warn('Error fetching artist details:', err.message);
        }
      }

      const artists = Array.from(artistsMap.values())
        .map(artist => ({
          ...artist,
          image: artistImages.get(artist.id) || '/placeholder.png'
        }))
        .sort((a, b) => b.trackCount - a.trackCount);

      contentHtml = `
        <h2 class="mb-4">Artisti nella playlist</h2>
        <div class="row">
          ${artists.map(artist => `
            <div class="col-md-4 mb-4">
              <div class="card h-100">
                <img src="${escapeHtml(artist.image)}" 
                     class="card-img-top" 
                     alt="${escapeHtml(artist.name)}"
                     onerror="this.src='/placeholder.png'">
                <div class="card-body">
                  <h5 class="card-title">${escapeHtml(artist.name)}</h5>
                  <p class="card-text">${artist.trackCount} brani</p>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      // Album view
      const albumsMap = new Map();

      tracks.forEach(item => {
        const track = item?.track;
        if (!track?.album || track.album.album_type !== 'album') return;
        
        const albumId = track.album.id;
        if (!albumsMap.has(albumId)) {
          albumsMap.set(albumId, {
            album: track.album,
            tracksInPlaylist: new Set(),
            totalTracks: track.album.total_tracks || 0
          });
        }
        albumsMap.get(albumId).tracksInPlaylist.add(track.id);
      });

      const albums = Array.from(albumsMap.values()).map(entry => {
        const percentage = entry.totalTracks === 0 ? 0 : 
          Math.round((entry.tracksInPlaylist.size / entry.totalTracks) * 100);
        return {
          id: entry.album.id,
          name: entry.album.name,
          artist: entry.album.artists.map(a => a.name).join(', '),
          image: entry.album.images?.[0]?.url || '/placeholder.png',
          tracksPresent: entry.tracksInPlaylist.size,
          totalTracks: entry.totalTracks,
          percentage
        };
      }).sort((a, b) => b.percentage - a.percentage);

      const totalPages = Math.ceil(albums.length / perPage);
      const paginatedAlbums = albums.slice((page - 1) * perPage, page * perPage);

      contentHtml = `
        <h2 class="mb-4">Album nella playlist</h2>
        <div class="row">
          ${paginatedAlbums.map(album => `
            <div class="col-md-4 mb-4">
              <div class="card h-100">
                <a href="/album/${escapeHtml(album.id)}?playlistId=${escapeHtml(playlistId)}" class="card-link">
                  <img src="${escapeHtml(album.image)}" 
                       class="card-img-top" 
                       alt="${escapeHtml(album.name)}"
                       onerror="this.src='/placeholder.png'">
                  <div class="card-body">
                    <h5 class="card-title">${escapeHtml(album.name)}</h5>
                    <p class="card-text">${escapeHtml(album.artist)}</p>
                    <p class="card-text">
                      ${album.tracksPresent}/${album.totalTracks} 
                      <strong>(${album.percentage}%)</strong>
                    </p>
                  </div>
                </a>
              </div>
            </div>
          `).join('')}
        </div>
        
        ${totalPages > 1 ? `
          <div class="pagination">
            ${page > 1 ? `<a href="/playlist/${escapeHtml(playlistId)}?view=album&page=${page - 1}" class="btn btn-primary">« Precedente</a>` : ''}
            <span class="page-info">Pagina ${page} di ${totalPages}</span>
            ${page < totalPages ? `<a href="/playlist/${escapeHtml(playlistId)}?view=album&page=${page + 1}" class="btn btn-primary">Successivo »</a>` : ''}
          </div>
        ` : ''}
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Playlist: ${escapeHtml(playlist.name)}</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body>
        <div class="container">
          <h1>${escapeHtml(playlist.name)}</h1>
          <p class="text-center">${escapeHtml(playlist.owner.display_name)}</p>
          <p class="text-center">${playlist.tracks.total} tracce</p>

          <div class="view-toggle">
            <a href="/playlist/${escapeHtml(playlistId)}?view=album" 
               class="btn ${view !== 'artist' ? 'btn-primary' : 'btn-outline-secondary'}">
               Vista Album
            </a>
            <a href="/playlist/${escapeHtml(playlistId)}?view=artist" 
               class="btn ${view === 'artist' ? 'btn-primary' : 'btn-outline-secondary'}">
               Vista Artisti
            </a>
          </div>

          ${contentHtml}

          <div class="text-center mt-4">
            <a href="/" class="btn btn-secondary">← Torna alle playlist</a>
          </div>
        </div>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    console.error('Error fetching playlist details:', err.message);
    if (err.response?.status === 401) {
      req.session.destroy();
      return res.redirect('/start');
    }
    handleError(res, 'Errore nel recuperare i dettagli della playlist.');
  }
});

// Album detail view
app.get('/album/:id', async (req, res) => {
  const accessToken = req.session.accessToken;
  const albumId = req.params.id;
  const playlistId = req.query.playlistId;

  try {
    // Get album details
    const albumResponse = await axios.get(`https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000
    });
    const album = albumResponse.data;

    // Get playlist tracks if playlistId provided
    let playlistTrackUris = [];
    if (playlistId) {
      let nextUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=50`;
      while (nextUrl) {
        const playlistResponse = await axios.get(nextUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000
        });
        playlistTrackUris.push(
          ...playlistResponse.data.items
            .map(item => item.track?.uri)
            .filter(Boolean)
        );
        nextUrl = playlistResponse.data.next;
      }
    }

    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Album - ${escapeHtml(album.name)}</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body>
        <div class="container">
          <div class="album-header">
            <img src="${escapeHtml(album.images?.[0]?.url || '/placeholder.png')}" 
                 alt="${escapeHtml(album.name)}" 
                 class="album-cover"
                 onerror="this.src='/placeholder.png'">
            <div class="album-info">
              <h1>${escapeHtml(album.name)}</h1>
              <h2>${album.artists.map(a => escapeHtml(a.name)).join(', ')}</h2>
              <p>${album.release_date}</p>
              <p>${album.total_tracks} tracce</p>
            </div>
          </div>
          
          <h3>Tracklist:</h3>
          <ol class="tracklist">
            ${album.tracks.items.map(track => {
              const isInPlaylist = playlistTrackUris.includes(track.uri);
              return `
                <li class="track-item ${isInPlaylist ? 'in-playlist' : 'not-in-playlist'}">
                  <span class="track-name">${escapeHtml(track.name)}</span>
                  <span class="track-status">${isInPlaylist ? '✅' : '❌'}</span>
                </li>
              `;
            }).join('')}
          </ol>
          
          <div class="text-center mt-4">
            <button onclick="history.back()" class="btn btn-secondary">← Torna indietro</button>
          </div>
        </div>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    console.error('Error fetching album details:', err.message);
    if (err.response?.status === 401) {
      req.session.destroy();
      return res.redirect('/start');
    }
    handleError(res, 'Impossibile recuperare i dettagli dell\'album.');
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Session destruction error:', err);
    }
    res.redirect('/start');
  });
});

// 404 handler
app.use((req, res) => {
  handleError(res, 'Pagina non trovata', 404);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  handleError(res, 'Si è verificato un errore interno del server');
});

// Start server
app.listen(port, () => {
  console.log(`🎵 Spotify Playlist Analyzer running on port ${port}`);
  console.log(`🌐 Visit: http://localhost:${port}/start`);
});
