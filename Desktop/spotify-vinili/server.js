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
        <title>Home</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body>
        <div class="container">
          <h1>Benvenuto</h1>
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

// Playlist detail view - Versione migliorata
app.get('/playlist/:id', async (req, res) => {
  const accessToken = req.session.accessToken;
  const playlistId = req.params.id;
  const view = req.query.view || 'album';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const perPage = 15;

  try {
    // Validazione parametri
    if (!accessToken) {
      return res.redirect('/start');
    }

    if (!playlistId || playlistId.trim() === '') {
      return handleError(res, 'ID playlist non valido.');
    }

    // Recupera info playlist e tracce in parallelo
    const [playlistInfo, allTracks] = await Promise.all([
      fetchPlaylistInfo(accessToken, playlistId),
      fetchAllPlaylistTracks(accessToken, playlistId)
    ]);

    // Filtra tracce valide
    const validTracks = allTracks.filter(item => 
      item?.track && !item.track.is_local && item.track.preview_url !== null
    );

    let contentHtml = '';

    if (view === 'artist') {
      contentHtml = await generateArtistView(accessToken, validTracks);
    } else {
      const { html, totalPages } = await generateAlbumView(validTracks, playlistId, page, perPage);
      contentHtml = html;
      
      // Aggiungi paginazione se necessario
      if (totalPages > 1) {
        contentHtml += generatePagination(playlistId, page, totalPages, 'album');
      }
    }

    const html = generatePageHTML(playlistInfo, playlistId, view, contentHtml);
    res.send(html);

  } catch (err) {
    console.error('Error fetching playlist details:', err.message);
    
    if (err.response?.status === 401) {
      req.session.destroy();
      return res.redirect('/start');
    }
    
    if (err.response?.status === 404) {
      return handleError(res, 'Playlist non trovata.');
    }
    
    if (err.response?.status === 403) {
      return handleError(res, 'Non hai i permessi per accedere a questa playlist.');
    }
    
    handleError(res, 'Errore nel recuperare i dettagli della playlist.');
  }
});

// Funzioni helper per organizzare meglio il codice

async function fetchPlaylistInfo(accessToken, playlistId) {
  const response = await axios.get(
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
      params: {
        fields: 'id,name,description,owner.display_name,tracks.total,images'
      }
    }
  );
  return response.data;
}

async function fetchAllPlaylistTracks(accessToken, playlistId) {
  const tracks = [];
  let nextUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`;
  let offset = 0;
  const limit = 50;

  while (nextUrl) {
    try {
      const response = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
        params: offset === 0 ? { 
          limit,
          fields: 'items(track(id,name,artists(id,name),album(id,name,artists,images,total_tracks,album_type))),next'
        } : undefined
      });

      tracks.push(...response.data.items);
      nextUrl = response.data.next;
      offset += limit;

      // Limita il numero massimo di tracce per evitare timeout
      if (tracks.length > 5000) {
        console.warn(`Playlist troppo grande, limitata a ${tracks.length} tracce`);
        break;
      }

    } catch (err) {
      console.warn(`Errore nel recuperare tracce (offset: ${offset}):`, err.message);
      break;
    }
  }

  return tracks;
}

async function generateArtistView(accessToken, tracks) {
  const artistsMap = new Map();

  // Raggruppa per artista
  tracks.forEach(item => {
    const track = item?.track;
    if (!track?.artists) return;
    
    track.artists.forEach(artist => {
      if (!artist?.id) return;
      if (!artistsMap.has(artist.id)) {
        artistsMap.set(artist.id, {
          id: artist.id,
          name: artist.name || 'Artista Sconosciuto',
          trackCount: 0,
          tracks: new Set()
        });
      }
      const artistData = artistsMap.get(artist.id);
      artistData.trackCount++;
      artistData.tracks.add(track.name);
    });
  });

  // Recupera dettagli artisti in batch con gestione errori migliorata
  const artistIds = Array.from(artistsMap.keys());
  const artistImages = await fetchArtistImages(accessToken, artistIds);

  const artists = Array.from(artistsMap.values())
    .map(artist => ({
      ...artist,
      image: artistImages.get(artist.id) || '/placeholder.png',
      tracks: Array.from(artist.tracks) // Converti Set in Array per il template
    }))
    .sort((a, b) => b.trackCount - a.trackCount)
    .slice(0, 100); // Limita per performance

  return `
    <div class="mb-4">
      <h2>Artisti nella playlist</h2>
      <p class="text-muted">${artists.length} artisti trovati</p>
    </div>
    <div class="row">
      ${artists.map(artist => `
        <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
          <div class="card h-100 shadow-sm">
            <div class="position-relative">
              <img src="${escapeHtml(artist.image)}" 
                   class="card-img-top" 
                   alt="${escapeHtml(artist.name)}"
                   style="height: 200px; object-fit: cover;"
                   onerror="this.src='/placeholder.png'; this.onerror=null;"
                   loading="lazy">
              <div class="position-absolute top-0 end-0 m-2">
                <span class="badge bg-primary">${artist.trackCount}</span>
              </div>
            </div>
            <div class="card-body d-flex flex-column">
              <h5 class="card-title text-truncate" title="${escapeHtml(artist.name)}">
                ${escapeHtml(artist.name)}
              </h5>
              <p class="card-text text-muted small">
                ${artist.trackCount} ${artist.trackCount === 1 ? 'brano' : 'brani'}
              </p>
              <div class="mt-auto">
                <a href="/artist/${escapeHtml(artist.id)}" class="btn btn-outline-primary btn-sm">
                  Visualizza Artista
                </a>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function fetchArtistImages(accessToken, artistIds) {
  const artistImages = new Map();
  const batchSize = 50;

  for (let i = 0; i < artistIds.length; i += batchSize) {
    const chunk = artistIds.slice(i, i + batchSize);
    try {
      const response = await axios.get(
        `https://api.spotify.com/v1/artists?ids=${chunk.join(',')}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000
        }
      );
      
      response.data.artists.forEach(artist => {
        if (artist) {
          artistImages.set(artist.id, artist.images?.[0]?.url || '/placeholder.png');
        }
      });
    } catch (err) {
      console.warn(`Errore nel recuperare dettagli artisti (batch ${Math.floor(i/batchSize) + 1}):`, err.message);
      // Continua con gli altri batch anche se uno fallisce
    }
    
    // Piccola pausa per evitare rate limiting
    if (i + batchSize < artistIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return artistImages;
}

async function generateAlbumView(tracks, playlistId, page, perPage) {
  const albumsMap = new Map();

  // Raggruppa per album (solo album completi, non singoli)
  tracks.forEach(item => {
    const track = item?.track;
    if (!track?.album) return;
    
    // Includi tutti i tipi di album ma dai priorità agli album completi
    const albumId = track.album.id;
    if (!albumsMap.has(albumId)) {
      albumsMap.set(albumId, {
        album: track.album,
        tracksInPlaylist: new Set(),
        totalTracks: track.album.total_tracks || 0,
        albumType: track.album.album_type || 'album'
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
      artist: entry.album.artists?.map(a => a.name).join(', ') || 'Artista Sconosciuto',
      image: entry.album.images?.[0]?.url || '/placeholder.png',
      tracksPresent: entry.tracksInPlaylist.size,
      totalTracks: entry.totalTracks,
      percentage,
      albumType: entry.albumType,
      releaseDate: entry.album.release_date
    };
  }).sort((a, b) => {
    // Ordina per percentuale, poi per tipo album, poi per data
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    if (a.albumType !== b.albumType) {
      if (a.albumType === 'album') return -1;
      if (b.albumType === 'album') return 1;
    }
    return new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0);
  });

  const totalPages = Math.ceil(albums.length / perPage);
  const paginatedAlbums = albums.slice((page - 1) * perPage, page * perPage);

  const html = `
    <div class="mb-4">
      <h2>Album nella playlist</h2>
      <p class="text-muted">${albums.length} album trovati</p>
    </div>
    <div class="row">
      ${paginatedAlbums.map(album => `
        <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
          <div class="card h-100 shadow-sm">
            <a href="/album/${escapeHtml(album.id)}?playlistId=${escapeHtml(playlistId)}" 
               class="text-decoration-none">
              <div class="position-relative">
                <img src="${escapeHtml(album.image)}" 
                     class="card-img-top" 
                     alt="${escapeHtml(album.name)}"
                     style="height: 200px; object-fit: cover;"
                     onerror="this.src='/placeholder.png'; this.onerror=null;"
                     loading="lazy">
                <div class="position-absolute top-0 end-0 m-2">
                  <span class="badge ${album.percentage === 100 ? 'bg-success' : album.percentage >= 50 ? 'bg-warning' : 'bg-secondary'}">
                    ${album.percentage}%
                  </span>
                </div>
                ${album.albumType !== 'album' ? `
                  <div class="position-absolute top-0 start-0 m-2">
                    <span class="badge bg-info text-capitalize">${album.albumType}</span>
                  </div>
                ` : ''}
              </div>
              <div class="card-body d-flex flex-column">
                <h5 class="card-title text-truncate text-dark" title="${escapeHtml(album.name)}">
                  ${escapeHtml(album.name)}
                </h5>
                <p class="card-text text-muted small text-truncate" title="${escapeHtml(album.artist)}">
                  ${escapeHtml(album.artist)}
                </p>
                <div class="mt-auto">
                  <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">
                      ${album.tracksPresent}/${album.totalTracks} brani
                    </small>
                    <div class="progress" style="width: 60px; height: 6px;">
                      <div class="progress-bar ${album.percentage === 100 ? 'bg-success' : 'bg-primary'}" 
                           style="width: ${album.percentage}%"></div>
                    </div>
                  </div>
                </div>
              </div>
            </a>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  return { html, totalPages };
}

function generatePagination(playlistId, currentPage, totalPages, view) {
  const maxVisiblePages = 5;
  const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  let paginationHtml = '<nav aria-label="Navigazione pagine"><ul class="pagination justify-content-center">';

  // Previous button
  if (currentPage > 1) {
    paginationHtml += `
      <li class="page-item">
        <a class="page-link" href="/playlist/${escapeHtml(playlistId)}?view=${view}&page=${currentPage - 1}">
          <span aria-hidden="true">&laquo;</span>
        </a>
      </li>
    `;
  }

  // Page numbers
  for (let i = startPage; i <= endPage; i++) {
    paginationHtml += `
      <li class="page-item ${i === currentPage ? 'active' : ''}">
        <a class="page-link" href="/playlist/${escapeHtml(playlistId)}?view=${view}&page=${i}">
          ${i}
        </a>
      </li>
    `;
  }

  // Next button
  if (currentPage < totalPages) {
    paginationHtml += `
      <li class="page-item">
        <a class="page-link" href="/playlist/${escapeHtml(playlistId)}?view=${view}&page=${currentPage + 1}">
          <span aria-hidden="true">&raquo;</span>
        </a>
      </li>
    `;
  }

  paginationHtml += '</ul></nav>';
  return paginationHtml;
}

function generatePageHTML(playlist, playlistId, view, contentHtml) {
  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Playlist: ${escapeHtml(playlist.name)}</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link rel="stylesheet" href="/styles.css">
      <style>
        .card {
          transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
        }
        .card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }
        .view-toggle {
          margin: 2rem 0;
        }
        .playlist-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 3rem 0;
          margin-bottom: 2rem;
          border-radius: 0.5rem;
        }
      </style>
    </head>
    <body>
      <div class="container-fluid">
        <div class="playlist-header text-center">
          <div class="container">
            <h1 class="display-4 mb-3">${escapeHtml(playlist.name)}</h1>
            ${playlist.description ? `<p class="lead">${escapeHtml(playlist.description)}</p>` : ''}
            <p class="mb-2">
              <strong>Creata da:</strong> ${escapeHtml(playlist.owner.display_name)}
            </p>
            <p class="mb-0">
              <strong>${playlist.tracks.total}</strong> ${playlist.tracks.total === 1 ? 'traccia' : 'tracce'}
            </p>
          </div>
        </div>

        <div class="container">
          <div class="view-toggle text-center">
            <div class="btn-group" role="group" aria-label="Vista">
              <a href="/playlist/${escapeHtml(playlistId)}?view=album" 
                 class="btn ${view !== 'artist' ? 'btn-primary' : 'btn-outline-primary'}">
                 Vista Album
              </a>
              <a href="/playlist/${escapeHtml(playlistId)}?view=artist" 
                 class="btn ${view === 'artist' ? 'btn-primary' : 'btn-outline-primary'}">
                 Vista Artisti
              </a>
            </div>
          </div>

          ${contentHtml}

          <div class="text-center mt-5 mb-4">
            <a href="/" class="btn btn-secondary btn-lg">
              ← Torna alle playlist
            </a>
          </div>
        </div>
      </div>

      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    </body>
    </html>
  `;
}

// Album detail view - Versione migliorata
app.get('/album/:id', async (req, res) => {
  const accessToken = req.session.accessToken;
  const albumId = req.params.id;
  const playlistId = req.query.playlistId;
  const returnUrl = req.query.returnUrl || (playlistId ? `/playlist/${playlistId}` : '/');

  try {
    // Validazione parametri
    if (!accessToken) {
      return res.redirect('/start');
    }

    if (!albumId || albumId.trim() === '') {
      return handleError(res, 'ID album non valido.');
    }

    // Recupera dettagli album e tracce playlist in parallelo se necessario
    const promises = [fetchAlbumDetails(accessToken, albumId)];
    
    if (playlistId) {
      promises.push(fetchPlaylistTrackUris(accessToken, playlistId));
    }

    const [albumData, playlistTrackUris = []] = await Promise.all(promises);

    // Arricchisci i dati delle tracce con informazioni aggiuntive
    const enrichedTracks = await enrichTrackData(albumData.tracks.items, playlistTrackUris);

    // Calcola statistiche
    const stats = calculateAlbumStats(albumData, enrichedTracks, playlistTrackUris);

    const html = generateAlbumHTML(albumData, enrichedTracks, stats, playlistId, returnUrl);
    res.send(html);

  } catch (err) {
    console.error('Error fetching album details:', err.message);
    
    if (err.response?.status === 401) {
      req.session.destroy();
      return res.redirect('/start');
    }
    
    if (err.response?.status === 404) {
      return handleError(res, 'Album non trovato.');
    }
    
    if (err.response?.status === 403) {
      return handleError(res, 'Non hai i permessi per accedere a questo album.');
    }
    
    handleError(res, 'Impossibile recuperare i dettagli dell\'album.');
  }
});

// Funzioni helper per organizzare il codice

async function fetchAlbumDetails(accessToken, albumId) {
  const response = await axios.get(
    `https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
      params: {
        market: 'IT' // Ottimizza per il mercato italiano
      }
    }
  );
  return response.data;
}

async function fetchPlaylistTrackUris(accessToken, playlistId) {
  const trackUris = [];
  let nextUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`;
  let offset = 0;
  const limit = 50;

  while (nextUrl) {
    try {
      const response = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
        params: offset === 0 ? { 
          limit,
          fields: 'items(track(uri,id)),next'
        } : undefined
      });

      const uris = response.data.items
        .map(item => item.track?.uri)
        .filter(Boolean);
      
      trackUris.push(...uris);
      nextUrl = response.data.next;
      offset += limit;

      // Limitazione per performance
      if (trackUris.length > 10000) {
        console.warn('Playlist troppo grande, limitata a 10000 tracce');
        break;
      }

    } catch (err) {
      console.warn(`Errore nel recuperare tracce playlist (offset: ${offset}):`, err.message);
      break;
    }
  }

  return trackUris;
}

async function enrichTrackData(tracks, playlistTrackUris) {
  return tracks.map(track => {
    const isInPlaylist = playlistTrackUris.includes(track.uri);
    const durationMs = track.duration_ms || 0;
    const duration = formatDuration(durationMs);
    
    return {
      ...track,
      isInPlaylist,
      duration,
      durationMs,
      isExplicit: track.explicit || false,
      trackNumber: track.track_number || 0,
      discNumber: track.disc_number || 1,
      popularity: track.popularity || 0,
      previewUrl: track.preview_url,
      isPlayable: track.is_playable !== false
    };
  });
}

function calculateAlbumStats(album, tracks, playlistTrackUris) {
  const totalDuration = tracks.reduce((sum, track) => sum + track.durationMs, 0);
  const tracksInPlaylist = tracks.filter(track => track.isInPlaylist).length;
  const completionPercentage = Math.round((tracksInPlaylist / tracks.length) * 100);
  const explicitTracks = tracks.filter(track => track.isExplicit).length;
  const playableTracks = tracks.filter(track => track.isPlayable).length;
  const averagePopularity = Math.round(
    tracks.reduce((sum, track) => sum + track.popularity, 0) / tracks.length
  );

  return {
    totalDuration: formatDuration(totalDuration),
    totalDurationMs: totalDuration,
    tracksInPlaylist,
    totalTracks: tracks.length,
    completionPercentage,
    explicitTracks,
    playableTracks,
    averagePopularity,
    releaseYear: new Date(album.release_date).getFullYear(),
    label: album.label || 'Etichetta sconosciuta'
  };
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatReleaseDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function generateAlbumHTML(album, tracks, stats, playlistId, returnUrl) {
  // Raggruppa le tracce per disco se multi-disco
  const tracksByDisc = tracks.reduce((acc, track) => {
    const discNum = track.discNumber;
    if (!acc[discNum]) acc[discNum] = [];
    acc[discNum].push(track);
    return acc;
  }, {});

  const isMultiDisc = Object.keys(tracksByDisc).length > 1;

  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(album.name)} - ${album.artists.map(a => a.name).join(', ')}</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
      <link rel="stylesheet" href="/styles.css">
      <style>
        .album-hero {
          background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
          color: white;
          padding: 4rem 0;
          margin-bottom: 2rem;
        }
        .album-cover {
          width: 300px;
          height: 300px;
          object-fit: cover;
          border-radius: 15px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
          transition: transform 0.3s ease;
        }
        .album-cover:hover {
          transform: scale(1.05);
        }
        .track-item {
          transition: all 0.3s ease;
          border-radius: 8px;
          margin-bottom: 0.5rem;
        }
        .track-item:hover {
          background-color: rgba(0,0,0,0.05);
          transform: translateX(5px);
        }
        .track-item.in-playlist {
          background-color: rgba(40, 167, 69, 0.1);
          border-left: 4px solid #28a745;
        }
        .track-item.not-in-playlist {
          background-color: rgba(220, 53, 69, 0.1);
          border-left: 4px solid #dc3545;
        }
        .stats-card {
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 15px;
        }
        .progress-custom {
          height: 8px;
          border-radius: 10px;
        }
        .disc-section {
          margin-bottom: 2rem;
        }
        .play-button {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: none;
          background: #1db954;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }
        .play-button:hover {
          background: #1ed760;
          transform: scale(1.1);
        }
        .genre-badge {
          background: rgba(255,255,255,0.2);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.875rem;
          margin-right: 0.5rem;
          margin-bottom: 0.5rem;
          display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="album-hero">
        <div class="container">
          <div class="row align-items-center">
            <div class="col-md-4 text-center">
              <img src="${escapeHtml(album.images?.[0]?.url || '/placeholder.png')}" 
                   alt="${escapeHtml(album.name)}" 
                   class="album-cover"
                   onerror="this.src='/placeholder.png'; this.onerror=null;">
            </div>
            <div class="col-md-8">
              <div class="mb-2">
                <span class="badge bg-light text-dark text-uppercase">${escapeHtml(album.album_type || 'Album')}</span>
                ${album.explicit ? '<span class="badge bg-warning text-dark ms-2">Explicit</span>' : ''}
              </div>
              <h1 class="display-4 mb-3">${escapeHtml(album.name)}</h1>
              <h2 class="h3 mb-3">
                ${album.artists.map(a => `
                  <a href="/artist/${escapeHtml(a.id)}" class="text-white text-decoration-none">
                    ${escapeHtml(a.name)}
                  </a>
                `).join(', ')}
              </h2>
              
              <div class="row text-center mb-4">
                <div class="col-6 col-md-3">
                  <div class="stats-card p-3">
                    <div class="h4 mb-1">${stats.totalTracks}</div>
                    <small>Tracce</small>
                  </div>
                </div>
                <div class="col-6 col-md-3">
                  <div class="stats-card p-3">
                    <div class="h4 mb-1">${stats.totalDuration}</div>
                    <small>Durata</small>
                  </div>
                </div>
                <div class="col-6 col-md-3">
                  <div class="stats-card p-3">
                    <div class="h4 mb-1">${stats.releaseYear}</div>
                    <small>Anno</small>
                  </div>
                </div>
                <div class="col-6 col-md-3">
                  <div class="stats-card p-3">
                    <div class="h4 mb-1">${stats.averagePopularity}/100</div>
                    <small>Popolarità</small>
                  </div>
                </div>
              </div>

              ${playlistId ? `
                <div class="stats-card p-3 mb-3">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>Completamento Playlist</span>
                    <span class="fw-bold">${stats.completionPercentage}%</span>
                  </div>
                  <div class="progress progress-custom">
                    <div class="progress-bar ${stats.completionPercentage === 100 ? 'bg-success' : 'bg-primary'}" 
                         style="width: ${stats.completionPercentage}%"></div>
                  </div>
                  <small class="text-light">
                    ${stats.tracksInPlaylist} di ${stats.totalTracks} tracce nella playlist
                  </small>
                </div>
              ` : ''}

              <div class="mb-3">
                <p class="mb-2"><strong>Data di rilascio:</strong> ${formatReleaseDate(album.release_date)}</p>
                <p class="mb-2"><strong>Etichetta:</strong> ${escapeHtml(stats.label)}</p>
                ${stats.explicitTracks > 0 ? `<p class="mb-2"><strong>Contenuti espliciti:</strong> ${stats.explicitTracks} tracce</p>` : ''}
              </div>

              ${album.genres && album.genres.length > 0 ? `
                <div class="mb-3">
                  ${album.genres.map(genre => `<span class="genre-badge">${escapeHtml(genre)}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="container">
        <div class="row">
          <div class="col-lg-8">
            <h3 class="mb-4">
              <i class="bi bi-music-note-list me-2"></i>
              Tracklist
              ${playlistId ? `<small class="text-muted ms-2">(${stats.completionPercentage}% nella playlist)</small>` : ''}
            </h3>

            ${Object.entries(tracksByDisc).map(([discNum, discTracks]) => `
              ${isMultiDisc ? `<h4 class="mt-4 mb-3">Disco ${discNum}</h4>` : ''}
              <div class="disc-section">
                ${discTracks.map((track, index) => `
                  <div class="track-item p-3 ${track.isInPlaylist ? 'in-playlist' : 'not-in-playlist'}">
                    <div class="row align-items-center">
                      <div class="col-auto">
                        <div class="d-flex align-items-center">
                          <span class="track-number me-3 text-muted" style="min-width: 30px;">
                            ${track.trackNumber}
                          </span>
                          ${track.previewUrl ? `
                            <button class="play-button me-3" onclick="togglePreview('${track.previewUrl}', this)" title="Anteprima">
                              <i class="bi bi-play-fill"></i>
                            </button>
                          ` : ''}
                        </div>
                      </div>
                      <div class="col">
                        <div class="d-flex flex-column">
                          <div class="d-flex align-items-center">
                            <strong class="track-name me-2">${escapeHtml(track.name)}</strong>
                            ${track.isExplicit ? '<span class="badge bg-secondary badge-sm">E</span>' : ''}
                            ${!track.isPlayable ? '<span class="badge bg-warning badge-sm ms-1">Non disponibile</span>' : ''}
                          </div>
                          ${track.artists && track.artists.length > 1 ? `
                            <small class="text-muted">
                              ${track.artists.map(a => escapeHtml(a.name)).join(', ')}
                            </small>
                          ` : ''}
                        </div>
                      </div>
                      <div class="col-auto">
                        <div class="d-flex align-items-center">
                          <span class="track-duration text-muted me-3">${track.duration}</span>
                          <span class="track-status fs-4" title="${track.isInPlaylist ? 'Nella playlist' : 'Non nella playlist'}">
                            ${track.isInPlaylist ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-x-circle-fill text-danger"></i>'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>

          <div class="col-lg-4">
            <div class="card sticky-top" style="top: 2rem;">
              <div class="card-header">
                <h5 class="mb-0"><i class="bi bi-info-circle me-2"></i>Informazioni Album</h5>
              </div>
              <div class="card-body">
                <ul class="list-unstyled mb-0">
                  <li class="mb-2">
                    <strong>Popolarità:</strong> 
                    <div class="progress mt-1" style="height: 6px;">
                      <div class="progress-bar bg-success" style="width: ${stats.averagePopularity}%"></div>
                    </div>
                    <small class="text-muted">${stats.averagePopularity}/100</small>
                  </li>
                  <li class="mb-2"><strong>Tracce riproducibili:</strong> ${stats.playableTracks}/${stats.totalTracks}</li>
                  <li class="mb-2"><strong>Durata totale:</strong> ${stats.totalDuration}</li>
                  ${album.copyrights && album.copyrights.length > 0 ? `
                    <li class="mb-2">
                      <strong>Copyright:</strong>
                      <small class="d-block text-muted">
                        ${album.copyrights.map(c => escapeHtml(c.text)).join('<br>')}
                      </small>
                    </li>
                  ` : ''}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div class="text-center mt-5 mb-4">
          <a href="${escapeHtml(returnUrl)}" class="btn btn-primary btn-lg me-3">
            <i class="bi bi-arrow-left me-2"></i>Torna indietro
          </a>
          <a href="${album.external_urls?.spotify || '#'}" target="_blank" class="btn btn-success btn-lg">
            <i class="bi bi-spotify me-2"></i>Apri in Spotify
          </a>
        </div>
      </div>

      <!-- Audio player per anteprime -->
      <audio id="previewPlayer" preload="none"></audio>

      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
      <script>
        let currentAudio = null;
        let currentButton = null;

        function togglePreview(previewUrl, button) {
          const audio = document.getElementById('previewPlayer');
          
          // Se è la stessa traccia, pausa/riprendi
          if (currentAudio === previewUrl && !audio.paused) {
            audio.pause();
            button.innerHTML = '<i class="bi bi-play-fill"></i>';
            return;
          }
          
          // Ferma la traccia corrente se diversa
          if (currentButton && currentButton !== button) {
            currentButton.innerHTML = '<i class="bi bi-play-fill"></i>';
          }
          
          // Avvia nuova traccia
          audio.src = previewUrl;
          audio.play().then(() => {
            button.innerHTML = '<i class="bi bi-pause-fill"></i>';
            currentAudio = previewUrl;
            currentButton = button;
          }).catch(err => {
            console.warn('Errore riproduzione anteprima:', err);
            button.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i>';
          });
          
          // Gestisci fine traccia
          audio.onended = () => {
            button.innerHTML = '<i class="bi bi-play-fill"></i>';
            currentAudio = null;
            currentButton = null;
          };
        }

        // Ferma audio quando si lascia la pagina
        window.addEventListener('beforeunload', () => {
          const audio = document.getElementById('previewPlayer');
          if (!audio.paused) {
            audio.pause();
          }
        });
      </script>
    </body>
    </html>
  `;
}

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
