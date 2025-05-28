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

  const response = await axios.post('https://accounts.spotify.com/api/token', params, {
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  if (response.status === 200) {
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
    };
  } else {
    throw new Error('Errore ottenendo token di accesso');
  }
}

async function refreshAccessToken(refreshToken) {
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const params = querystring.stringify({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await axios.post('https://accounts.spotify.com/api/token', params, {
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  if (response.status === 200) {
    return {
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
    };
  } else {
    throw new Error('Errore rinfrescando token');
  }
}

// Middleware: proteggi routes tranne start/login/callback
function checkAccessToken(req, res, next) {
  const publicPaths = ['/start', '/login', '/callback'];
  if (publicPaths.includes(req.path)) return next();
  if (!req.session.accessToken) {
    return res.redirect('/start');
  }
  next();
}

// Pagina iniziale login
app.get('/start', (req, res) => {
  res.send(`
    <html>
      <head><title>Login Spotify</title><link rel="stylesheet" href="/styles.css"></head>
      <body>
        <div class="container">
          <h1>Benvenuto</h1>
          <p style="text-align:center;"><a href="/login" class="btn btn-primary">Accedi con Spotify</a></p>
        </div>
      </body>
    </html>
  `);
});

// Login: redirect a Spotify
app.get("/login", (req, res) => {
  const scopes = 'playlist-read-private'; // o qualsiasi altro scope
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
  });
  res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

// Callback OAuth Spotify
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return handleError(res, 'Nessun codice fornito', 400);

  try {
    const tokens = await getAccessToken(code);
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token;
    res.redirect('/');
  } catch (err) {
    console.error('Errore token:', err);
    handleError(res, 'Errore autenticazione Spotify');
  }
});

// Proteggi tutte le route successive
app.use(checkAccessToken);

// Home: lista playlist utente
app.get('/', async (req, res) => {
  const accessToken = req.session.accessToken;
  try {
    let playlists = [];
    let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=50';

    while (nextUrl) {
      const response = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      playlists.push(...response.data.items);
      nextUrl = response.data.next;
    }

    playlists.sort((a, b) => b.tracks.total - a.tracks.total);

    const page = Math.max(1, parseInt(req.query.page) || 1); // Fix: sempre >= 1
    const perPage = 6;
    const totalPages = Math.ceil(playlists.length / perPage);
    const paginated = playlists.slice((page - 1) * perPage, page * perPage);

    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <title>Le tue Playlist Spotify</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body>
        <div class="container">
          <h1>Le tue Playlist Spotify</h1>
          <div class="row">
            ${paginated.map(p => `
              <div class="col-md-4">
                <div class="card">
                  <a href="/playlist/${escapeHtml(p.id)}" class="card">
                    <img src="${escapeHtml(p.images?.[0]?.url || '')}" alt="${escapeHtml(p.name)}" class="card-img-top">
                    <div class="card-body">
                      <h5 class="card-title">${escapeHtml(p.name)}</h5>
                      <p class="card-text">Proprietario: ${escapeHtml(p.owner.display_name)}</p>
                      <p class="card-text">Tracce: ${p.tracks.total}</p>
                    </div>
                  </a>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="pagination">
            ${page > 1 ? `<a href="/?page=${page - 1}" class="btn btn-primary">Precedente</a>` : ''}
            ${page < totalPages ? `<a href="/?page=${page + 1}" class="btn btn-primary">Successivo</a>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    console.error('Errore playlist:', err.message);
    handleError(res, 'Impossibile recuperare le playlist. Riprova più tardi.');
  }
});

app.get('/playlist/:id', async (req, res) => {
  const accessToken = req.session.accessToken;
  const playlistId = req.params.id;
  const view = req.query.view || 'album';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const perPage = 15;

  if (!accessToken) {
    return handleError(res, 'Token di accesso mancante o scaduto. Riprova a fare login.');
  }

  // Funzione per generare blocco HTML per errore generico
  const renderErrorPage = (message) => res.send(`
    <html><head><title>Errore</title></head>
    <body><h1>Errore</h1><p>${escapeHtml(message)}</p></body></html>
  `);

  try {
    // 1. Recupero playlist
    const playlistRes = await axios.get(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const playlist = playlistRes.data;

    // 2. Caricamento completo delle tracce (con paginazione)
    let tracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`;
    while (nextUrl) {
      const trackRes = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      tracks.push(...trackRes.data.items);
      nextUrl = trackRes.data.next;
    }

    console.log(`Caricata playlist "${playlist.name}" con ${tracks.length} tracce.`);

    let contentHtml = '';

    // === VISTA ARTISTI ===
    if (view === 'artist') {
      const artistsMap = new Map();

      for (const item of tracks) {
      const track = item?.track;
      if (!track || !Array.isArray(track.artists)) continue;
    
      for (const artist of track.artists) {
        if (!artist?.id) continue;
        if (!artistsMap.has(artist.id)) {
          artistsMap.set(artist.id, {
            id: artist.id,
            name: artist.name || 'Sconosciuto',
            trackCount: 0
          });
        }
        artistsMap.get(artist.id).trackCount++;
      }
    }

      const artistIds = Array.from(artistsMap.keys());
      const artistDetails = [];
      const chunkSize = 50;

      for (let i = 0; i < artistIds.length; i += chunkSize) {
        const chunk = artistIds.slice(i, i + chunkSize);
        try {
          const artistRes = await axios.get(`https://api.spotify.com/v1/artists?ids=${chunk.join(',')}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          artistDetails.push(...artistRes.data.artists);
        } catch (err) {
          console.warn('Errore fetch artisti:', chunk, err.response?.data || err.message);
        }
      }

      const artistImages = new Map();
      for (const artist of artistDetails) {
        artistImages.set(artist.id, artist.images?.[0]?.url || null);
      }

      const artists = artistIds.map(id => ({
        id,
        name: artistsMap.get(id).name,
        trackCount: artistsMap.get(id).trackCount,
        image: artistImages.get(id) || 'https://via.placeholder.com/300?text=No+Image'
      })).sort((a, b) => b.trackCount - a.trackCount);

      contentHtml = `
        <h2 class="mb-4">Artisti presenti nella playlist "${escapeHtml(playlist.name)}"</h2>
        <div class="row">
          ${artists.map(artist => `
            <div class="col-md-4 mb-4">
              <div class="card h-100 shadow-sm border-0">
                <img src="${escapeHtml(artist.image)}" class="card-img-top" alt="Immagine di ${escapeHtml(artist.name)}">
                <div class="card-body">
                  <h5 class="card-title">${escapeHtml(artist.name)}</h5>
                  <p class="card-text">Brani nella playlist: ${artist.trackCount}</p>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

    } else {
      // === VISTA ALBUM ===
      const albumsMap = new Map();

      for (const item of tracks) {
        const track = item.track;
        if (!track || !track.album) continue;
        if (track.album.album_type !== 'album') continue;

        const albumId = track.album.id;
        if (!albumsMap.has(albumId)) {
          albumsMap.set(albumId, {
            album: track.album,
            tracksInPlaylist: new Set(),
            totalTracks: track.album.total_tracks || 0
          });
        }
        albumsMap.get(albumId).tracksInPlaylist.add(track.id);
      }

      const albums = Array.from(albumsMap.values()).map(a => {
        const perc = a.totalTracks === 0 ? 0 : Math.round((a.tracksInPlaylist.size / a.totalTracks) * 100);
        return {
          id: a.album.id,
          name: a.album.name,
          artist: a.album.artists.map(ar => ar.name).join(', '),
          image: a.album.images[0]?.url || 'https://via.placeholder.com/300?text=No+Image',
          tracksPresent: a.tracksInPlaylist.size,
          totalTracks: a.totalTracks,
          percentuale: perc
        };
      });

      albums.sort((a, b) => b.percentuale - a.percentuale);
      const totalPages = Math.ceil(albums.length / perPage);
      const paginated = albums.slice((page - 1) * perPage, page * perPage);

      contentHtml = `
        <h2>Album presenti nella playlist</h2>
        <div class="row">
          ${paginated.map(album => `
            <div class="col-md-4 mb-4">
              <div class="card h-100">
                <a href="/album/${escapeHtml(album.id)}?playlistId=${escapeHtml(playlistId)}" class="card-link">
                  <img src="${escapeHtml(album.image)}" class="card-img-top" alt="${escapeHtml(album.name)}">
                  <div class="card-body">
                    <h5 class="card-title">${escapeHtml(album.name)}</h5>
                    <p class="card-text">Artista: ${escapeHtml(album.artist)}</p>
                    <p class="card-text">
                      Tracce nella playlist: ${album.tracksPresent} / ${album.totalTracks} 
                      <strong>(${album.percentuale}%)</strong>
                    </p>
                  </div>
                </a>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="d-flex justify-content-between my-4">
          ${page > 1 ? `<a href="/playlist/${escapeHtml(playlistId)}?view=album&page=${page - 1}" class="btn btn-primary">Precedente</a>` : '<div></div>'}
          ${page < totalPages ? `<a href="/playlist/${escapeHtml(playlistId)}?view=album&page=${page + 1}" class="btn btn-primary">Successivo</a>` : ''}
        </div>
      `;
    }

    // === HTML FINALE ===
    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8" />
        <title>Playlist: ${escapeHtml(playlist.name)}</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="container py-4">
        <h1>Playlist: ${escapeHtml(playlist.name)}</h1>
        <p class="text-center">Proprietario: ${escapeHtml(playlist.owner.display_name)}</p>
        <p class="text-center">Numero tracce: ${playlist.tracks.total}</p>

        <div class="text-center mb-4">
          <a href="/playlist/${escapeHtml(playlistId)}?view=album" class="btn ${view !== 'artist' ? 'btn-primary' : 'btn-secondary'}">Album</a>
          <a href="/playlist/${escapeHtml(playlistId)}?view=artist" class="btn ${view === 'artist' ? 'btn-primary' : 'btn-secondary'}">Artisti</a>
        </div>

        ${contentHtml}

        <div class="text-center mt-4">
          <a href="/" class="btn btn-secondary">Torna alle playlist</a>
        </div>
      </body>
      </html>
    `;

    res.send(html);

  } catch (err) {
    console.error('Errore nel dettaglio playlist:', err.response?.data || err.message);
    return renderErrorPage('Errore nel recuperare i dettagli della playlist. Riprova più tardi.');
  }
});

// Dettaglio album con confronto con playlist
app.get('/album/:id', async (req, res) => {
  const accessToken = req.session.accessToken;
  const albumId = req.params.id;
  const playlistId = req.query.playlistId;

  try {
    // Recupera dati dell'album
    const albumResponse = await axios.get(`https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const album = albumResponse.data;
    const albumTracks = album.tracks.items;

    // Recupera gli URI delle tracce della playlist, se playlistId è fornito
    let playlistTrackUris = [];
    if (playlistId) {
      let nextUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`;
      while (nextUrl) {
        const playlistResponse = await axios.get(nextUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const items = playlistResponse.data.items;
        playlistTrackUris.push(
          ...items.map(item => item.track && item.track.uri).filter(Boolean)
        );
        nextUrl = playlistResponse.data.next;
      }
    }

    // Calcola la percentuale di tracce dell'album presenti nella playlist
    const totaleTracce = albumTracks.length;
    const traccePresenti = albumTracks.filter(track => playlistTrackUris.includes(track.uri)).length;
    const percentuale = totaleTracce === 0 ? 0 : Math.round((traccePresenti / totaleTracce) * 100);

    // Costruisci l’HTML di risposta
    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8" />
        <title>Album - ${escapeHtml(album.name)}</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <div class="container">
          <h1>${escapeHtml(album.name)} - ${album.artists.map(a => escapeHtml(a.name)).join(', ')}</h1>
          <img src="${escapeHtml(album.images[0]?.url || '')}" alt="${escapeHtml(album.name)}" style="max-width: 300px;" />
          <ol>
            Tracce:
            ${albumTracks.map(track => {
              const presente = playlistTrackUris.includes(track.uri);
              return `<li style="color: ${presente ? 'green' : 'red'}">
                        ${escapeHtml(track.name)} ${presente ? '✅' : '❌'}
                      </li>`;
            }).join('')}
          </ol>
          <p><a href="javascript:history.back()" class="btn btn-secondary">Torna indietro</a></p>
        </div>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    console.error('Errore nel dettaglio album:', err.message);
    handleError(res, 'Impossibile recuperare i dettagli dell\'album. Riprova più tardi.');
  }
});

// Avvio server
app.listen(port, () => console.log(`Server avviato sulla porta ${port}`));
