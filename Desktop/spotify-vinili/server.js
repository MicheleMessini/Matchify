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

// Validazione parametri
function validatePlaylistId(id) {
  return id && typeof id === 'string' && id.length > 0 && !/[<>"]/.test(id);
}

function validateAlbumId(id) {
  return id && typeof id === 'string' && id.length > 0 && !/[<>"]/.test(id);
}

function validatePageNumber(page) {
  const num = parseInt(page);
  return isNaN(num) ? 1 : Math.max(1, num);
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
  const publicPaths = ['/start', '/login', '/callback', '/health'];
  if (publicPaths.includes(req.path)) return next();
  
  if (!req.session.accessToken) {
    return res.redirect('/start');
  }
  next();
}

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.get('/start', (req, res) => {
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

app.get('/login', (req, res) => {
  const authUrl = getSpotifyAuthUrl();
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
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
  const page = validatePageNumber(req.query.page);
  
  try {
    // Get all user playlists
    let playlists = [];
    let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=50';
    while (nextUrl) {
      const data = await makeSpotifyRequest(nextUrl, accessToken);
      playlists.push(...data.items.filter(p => p && p.id)); // Filter out null/invalid playlists
      nextUrl = data.next;
    }

    // Get detailed info for each playlist including tracks duration
    const playlistsWithDuration = await Promise.all(
      playlists.map(async (playlist) => {
        try {
          let totalDuration = 0;
          let tracksUrl = `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=50&fields=items(track(duration_ms)),next`;
          
          while (tracksUrl) {
            const tracksData = await makeSpotifyRequest(tracksUrl, accessToken);
            if (tracksData.items) {
              totalDuration += tracksData.items.reduce((sum, item) => {
                return sum + (item.track?.duration_ms || 0);
              }, 0);
            }
            tracksUrl = tracksData.next;
          }
          
          return {
            ...playlist,
            totalDuration: totalDuration
          };
        } catch (error) {
          console.warn(`Error fetching tracks for playlist ${playlist.id}:`, error.message);
          return {
            ...playlist,
            totalDuration: 0
          };
        }
      })
    );

    // Sort playlists by tracks (default sorting)
    playlistsWithDuration.sort((a, b) => (b.tracks?.total || 0) - (a.tracks?.total || 0));

    // Pagination
    const perPage = 6;
    const totalPages = Math.ceil(playlistsWithDuration.length / perPage);
    const paginatedPlaylists = playlistsWithDuration.slice((page - 1) * perPage, page * perPage);

    // Helper function to format duration
    const formatDuration = (milliseconds) => {
      const totalSeconds = Math.floor(milliseconds / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else {
        return `${minutes}m`;
      }
    };

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
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h1>Le tue Playlist</h1>
          </div>
          
          ${playlistsWithDuration.length === 0 ? `
            <div class="text-center">
              <p>Non hai ancora nessuna playlist. Creane una su Spotify!</p>
            </div>
          ` : `
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
                        <p class="card-text">
                          <small class="text-muted">
                            ${escapeHtml(playlist.owner?.display_name || 'Sconosciuto')} - 
                            ${playlist.tracks?.total || 0} tracce - 
                            ${formatDuration(playlist.totalDuration)}
                          </small>
                        </p>
                      </div>
                    </a>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
          
          ${totalPages > 1 ? `
            <div class="pagination">
              ${page > 1 ? `<a href="/?page=${page - 1}" class="btn btn-primary">« Precedente</a>` : ''}
              <span class="page-info">Pagina ${page} di ${totalPages}</span>
              ${page < totalPages ? `<a href="/?page=${page + 1}" class="btn btn-primary">Successivo »</a>` : ''}
            </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (err) {
    console.error('Error fetching playlists:', err.message);
    if (err.message === 'UNAUTHORIZED') {
      req.session.destroy();
      return res.redirect('/start');
    }
    if (err.message === 'RATE_LIMITED') {
      return handleError(res, 'Troppe richieste. Riprova tra qualche minuto.', 429);
    }
    handleError(res, 'Impossibile recuperare le playlist. Riprova più tardi.');
  }
});

// Playlist detail view
app.get('/playlist/:id', async (req, res) => {
  const playlistId = req.params.id;
  
  if (!validatePlaylistId(playlistId)) {
    return handleError(res, 'ID playlist non valido', 400);
  }

  const accessToken = req.session.accessToken;
  const view = req.query.view === 'artist' ? 'artist' : 'album';
  const page = validatePageNumber(req.query.page);
  const perPage = 15;

  try {
    // Get playlist info
    const playlist = await makeSpotifyRequest(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}`,
      accessToken
    );

    // Get all tracks
    let tracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=50`;
    
    while (nextUrl) {
      const data = await makeSpotifyRequest(nextUrl, accessToken);
      tracks.push(...data.items.filter(item => item?.track)); // Filter out null tracks
      nextUrl = data.next;
    }

    // Calculate playlist statistics
    const totalTracks = tracks.length;
    const totalDurationMs = tracks.reduce((total, item) => {
      return total + (item.track?.duration_ms || 0);
    }, 0);
    
    // Format total duration
    const totalHours = Math.floor(totalDurationMs / 3600000);
    const totalMinutes = Math.floor((totalDurationMs % 3600000) / 60000);
    const totalSeconds = Math.floor((totalDurationMs % 60000) / 1000);
    
    let durationText;
    if (totalHours > 0) {
      durationText = `${totalHours}h ${totalMinutes}m`;
    } else {
      durationText = `${totalMinutes}m ${totalSeconds}s`;
    }

    // Get unique artists count
    const uniqueArtists = new Set();
    tracks.forEach(item => {
      if (item.track?.artists) {
        item.track.artists.forEach(artist => {
          if (artist?.id) uniqueArtists.add(artist.id);
        });
      }
    });

    // Get unique albums count
    const uniqueAlbums = new Set();
    tracks.forEach(item => {
      if (item.track?.album?.id) {
        uniqueAlbums.add(item.track.album.id);
      }
    });

    let contentHtml = '';

    if (view === 'artist') {
      // Artist view
      const artistsMap = new Map();

      tracks.forEach(item => {
        const track = item.track;
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
          const data = await makeSpotifyRequest(
            `https://api.spotify.com/v1/artists?ids=${chunk.join(',')}`,
            accessToken
          );
          data.artists.forEach(artist => {
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
      .sort((a, b) => b.trackCount - a.trackCount)
      .slice(0, 50); // Limita ai primi 50 artisti
    
    contentHtml = `
      <h2 class="mb-4">Top 50 Artisti nella playlist</h2>
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
        const track = item.track;
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
        <h2 class="mb-4">Album nella playlist (${albums.length})</h2>
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
                    <p class="card-text">
                      <small class="text-muted">${escapeHtml(album.artist)}</small>
                    </p>
                    <p class="card-text">
                      <span class="badge ${album.percentage >= 50 ? 'bg-success' : album.percentage >= 25 ? 'bg-warning' : 'bg-secondary'}">
                        ${album.tracksPresent}/${album.totalTracks} (${album.percentage}%)
                      </span>
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
          <!-- Playlist Header with Stats -->
          <div class="playlist-header mb-4">
            <div class="row align-items-center">
              <div class="col-md-3">
                <img src="${escapeHtml(playlist.images?.[0]?.url || '/placeholder.png')}" 
                     alt="${escapeHtml(playlist.name)}" 
                     class="playlist-cover img-fluid rounded"
                     onerror="this.src='/placeholder.png'">
              </div>
              <div class="col-md-9">
                <h1 class="playlist-title">${escapeHtml(playlist.name)}</h1>
                ${playlist.description ? `<p class="playlist-description text-muted">${escapeHtml(playlist.description)}</p>` : ''}
                <div class="playlist-stats">
                  <div class="row">
                    <div class="col-6 col-md-3">
                      <div class="stat-item">
                        <div class="stat-number">${totalTracks}</div>
                        <div class="stat-label">Brani</div>
                      </div>
                    </div>
                    <div class="col-6 col-md-3">
                      <div class="stat-item">
                        <div class="stat-number">${durationText}</div>
                        <div class="stat-label">Durata</div>
                      </div>
                    </div>
                    <div class="col-6 col-md-3">
                      <div class="stat-item">
                        <div class="stat-number">${uniqueArtists.size}</div>
                        <div class="stat-label">Artisti</div>
                      </div>
                    </div>
                    <div class="col-6 col-md-3">
                      <div class="stat-item">
                        <div class="stat-number">${uniqueAlbums.size}</div>
                        <div class="stat-label">Album</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="view-toggle" style="margin-bottom: 2rem;">
            <a href="/playlist/${escapeHtml(playlistId)}?view=album" 
               class="btn ${view !== 'artist' ? 'btn-primary' : 'btn-outline-secondary'}">
               Album
            </a>
            <a href="/playlist/${escapeHtml(playlistId)}?view=artist" 
               class="btn ${view === 'artist' ? 'btn-primary' : 'btn-outline-secondary'}">
               Top Artisti
            </a>
          </div>

          ${contentHtml}

          <div class="text-center mt-4">
            <a href="/" class="btn btn-secondary">← Torna alle playlist</a>
          </div>
        </div>

        <style>
          .playlist-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 15px;
            margin-bottom: 2rem;
          }
          
          .playlist-cover {
            max-width: 200px;
            border-radius: 10px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
          }
          
          .playlist-title {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
          }
          
          .playlist-description {
            font-size: 1.1rem;
            margin-bottom: 1.5rem;
            opacity: 0.9;
          }
          
          .playlist-stats {
            background: rgba(255,255,255,0.1);
            padding: 1.5rem;
            border-radius: 10px;
            backdrop-filter: blur(10px);
          }
          
          .stat-item {
            text-align: center;
            margin-bottom: 1rem;
          }
          
          .stat-number {
            font-size: 1.8rem;
            font-weight: bold;
            color: #fff;
          }
          
          .stat-label {
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            opacity: 0.8;
          }
          
          @media (max-width: 768px) {
            .playlist-title {
              font-size: 1.8rem;
            }
            
            .stat-number {
              font-size: 1.4rem;
            }
          }
        </style>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    console.error('Error fetching playlist details:', err.message);
    if (err.message === 'UNAUTHORIZED') {
      req.session.destroy();
      return res.redirect('/start');
    }
    if (err.response?.status === 404) {
      return handleError(res, 'Playlist non trovata', 404);
    }
    if (err.message === 'RATE_LIMITED') {
      return handleError(res, 'Troppe richieste. Riprova tra qualche minuto.', 429);
    }
    handleError(res, 'Errore nel recuperare i dettagli della playlist.');
  }
});

// Album detail view
app.get('/album/:id', async (req, res) => {
  const albumId = req.params.id;
  
  if (!validateAlbumId(albumId)) {
    return handleError(res, 'ID album non valido', 400);
  }

  const accessToken = req.session.accessToken;
  const playlistId = req.query.playlistId;
  
  try {
    // Get album details
    const album = await makeSpotifyRequest(
      `https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}`,
      accessToken
    );
    
    // Get detailed track info with popularity
    const trackIds = album.tracks.items.map(track => track.id).join(',');
    const tracksDetails = await makeSpotifyRequest(
      `https://api.spotify.com/v1/tracks?ids=${trackIds}`,
      accessToken
    );
    
    // Calculate total album duration
    const totalDurationMs = album.tracks.items.reduce((total, track) => total + track.duration_ms, 0);
    const totalMinutes = Math.floor(totalDurationMs / 60000);
    const totalSeconds = Math.floor((totalDurationMs % 60000) / 1000);
    const totalDuration = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m ${totalSeconds}s`;
    
    // Get playlist tracks if playlistId provided
    let playlistTrackUris = [];
    if (playlistId && validatePlaylistId(playlistId)) {
      let nextUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=50`;
      while (nextUrl) {
        const data = await makeSpotifyRequest(nextUrl, accessToken);
        playlistTrackUris.push(
          ...data.items
            .map(item => item.track?.uri)
            .filter(Boolean)
        );
        nextUrl = data.next;
      }
    }
    
    const tracksInPlaylist = album.tracks.items.filter(track => 
      playlistTrackUris.includes(track.uri)
    ).length;
    
    const completionPercentage = album.total_tracks > 0 ? 
      Math.round((tracksInPlaylist / album.total_tracks) * 100) : 0;
    
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
              <p><strong>Data di uscita:</strong> ${album.release_date}</p>
              <p><strong>Tracce totali:</strong> ${album.total_tracks}</p>
              <p><strong>Durata totale:</strong> ${totalDuration}</p>
              ${playlistId ? `
                <div>
                  <span class="badge ${completionPercentage >= 80 ? 'bg-success' : completionPercentage >= 50 ? 'bg-warning' : 'bg-secondary'}">
                    ${tracksInPlaylist}/${album.total_tracks} nella playlist (${completionPercentage}%)
                  </span>
                </div>
              ` : ''}
            </div>
          </div>

          <h3>Tracklist:</h3>
          <ol class="tracklist">
            ${album.tracks.items.map((track, index) => {
              const isInPlaylist = playlistTrackUris.includes(track.uri);
              const minutes = Math.floor(track.duration_ms / 60000);
              const seconds = Math.floor((track.duration_ms % 60000) / 1000);
              const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
              
              // Get popularity from detailed track info
              const trackDetail = tracksDetails.tracks.find(t => t.id === track.id);
              const popularity = trackDetail ? trackDetail.popularity : 0;
              
              return `
                <li class="track-item ${isInPlaylist ? 'in-playlist' : ''}">
                  <div class="track-info">
                    <span class="track-number">${index + 1}</span>
                    <span class="track-name">${escapeHtml(track.name)}</span>
                  </div>
                  <div class="track-details">
                    <span class="track-duration">${duration}</span>
                    <span class="track-popularity">Popolarità: ${popularity}/100</span>
                    <span class="track-status">${isInPlaylist ? 'In playlist' : 'Non presente'}</span>
                  </div>
                </li>
              `;
            }).join('')}
          </ol>

          <div class="text-center">
            <button onclick="history.back()" class="btn btn-secondary">← Torna indietro</button>
          </div>
        </div>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (err) {
    console.error('Error fetching album details:', err.message);
    if (err.message === 'UNAUTHORIZED') {
      req.session.destroy();
      return res.redirect('/start');
    }
    if (err.response?.status === 404) {
      return handleError(res, 'Album non trovato', 404);
    }
    return handleError(res, 'Errore nel recupero dei dettagli dell\'album', 500);
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
