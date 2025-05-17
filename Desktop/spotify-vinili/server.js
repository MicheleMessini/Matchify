require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
const querystring = require('querystring');

const app = express();
const port = process.env.PORT || 3000;

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

// Helpers
function handleError(res, message, status = 500) {
  res.status(status).send(`
    <html>
      <head><title>Errore</title><link rel="stylesheet" href="/styles.css"></head>
      <body>
        <div class="container">
          <h2>❌ Errore</h2>
          <p>${message}</p>
          <a href="/" class="btn btn-secondary">Torna alla home</a>
        </div>
      </body>
    </html>
  `);
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
          <p><a href="/login" class="btn btn-primary">Accedi con Spotify</a></p>
        </div>
      </body>
    </html>
  `);
});

// Login: redirect a Spotify
app.get('/login', (req, res) => {
  const authUrl = getSpotifyAuthUrl();
  res.redirect(authUrl);
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

    const page = parseInt(req.query.page) || 1;
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
                  <a href="/playlist/${p.id}" class="card">
                    <img src="${p.images?.[0]?.url || ''}" alt="${p.name}" class="card-img-top">
                    <div class="card-body">
                      <h5 class="card-title">${p.name}</h5>
                      <p class="card-text">Proprietario: ${p.owner.display_name}</p>
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
      </html>`;
    res.send(html);
  } catch (err) {
    console.error('Errore playlist:', err.message);
    handleError(res, 'Impossibile recuperare le playlist. Riprova più tardi.');
  }
});

// Dettaglio playlist
app.get('/playlist/:id', async (req, res) => {
  const accessToken = req.session.accessToken;
  const playlistId = req.params.id;

  try {
    // Info playlist
    const playlistResponse = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const playlist = playlistResponse.data;

    // Tracce playlist
    let tracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
    while (nextUrl) {
      const response = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      tracks.push(...response.data.items);
      nextUrl = response.data.next;
    }

    // Raggruppa tracce per album
    const albumsMap = new Map();
    for (const item of tracks) {
      const track = item.track;
      if (!track || !track.album) continue;
      if (track.album.album_type !== 'album') continue;  // esclude singoli, podcast ecc.
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

    const albums = Array.from(albumsMap.values()).map(a => ({
      id: a.album.id,
      name: a.album.name,
      artist: a.album.artists.map(ar => ar.name).join(', '),
      image: a.album.images[0]?.url || '',
      tracksPresent: a.tracksInPlaylist.size,
      totalTracks: a.totalTracks
    }));

    // Ordina per percentuale tracce presenti
    albums.sort((a, b) => {
      const percA = a.totalTracks > 0 ? a.tracksPresent / a.totalTracks : 0;
      const percB = b.totalTracks > 0 ? b.tracksPresent / b.totalTracks : 0;
      return percB - percA;
    });

    const page = parseInt(req.query.page) || 1;
    const perPage = 15;
    const totalPages = Math.ceil(albums.length / perPage);
    const paginatedAlbums = albums.slice((page - 1) * perPage, page * perPage);

    // HTML
    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8" />
        <title>Dettaglio Playlist - ${playlist.name}</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <div class="container">
          <h1>Playlist: ${playlist.name}</h1>
          <p>Proprietario: ${playlist.owner.display_name}</p>
          <p>Numero tracce: ${playlist.tracks.total}</p>
          <h2>Album presenti nella playlist</h2>
          <div class="row">
            ${paginatedAlbums.map(album => `
              <div class="col-md-4">
                <div class="card">
                  <a href="/album/${album.id}?playlistId=${playlistId}" class="card-link">
                    <img src="${album.image}" alt="${album.name}" class="card-img-top" />
                    <div class="card-body">
                      <h5 class="card-title">${album.name}</h5>
                      <p class="card-text">Artista: ${album.artist}</p>
                      <p class="card-text">Tracce nella playlist: ${album.tracksPresent} / ${album.totalTracks}</p>
                    </div>
                  </a>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="pagination">
            ${page > 1 ? `<a href="/playlist/${playlistId}?page=${page - 1}" class="btn btn-primary">Precedente</a>` : ''}
            ${page < totalPages ? `<a href="/playlist/${playlistId}?page=${page + 1}" class="btn btn-primary">Successivo</a>` : ''}
          </div>
          <p><a href="/" class="btn btn-secondary">Torna alle playlist</a></p>
        </div>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    console.error('Errore nel dettaglio playlist:', err.message);
    handleError(res, 'Impossibile recuperare i dettagli della playlist. Riprova più tardi.');
  }
});

// Dettaglio album con confronto con playlist
app.get('/album/:id', async (req, res) => {
  const accessToken = req.session.accessToken;
  const albumId = req.params.id;
  const playlistId = req.query.playlistId;

  try {
    // Dati dell'album
    const albumResponse = await axios.get(`https://api.spotify.com/v1/albums/${albumId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const album = albumResponse.data;
    const albumTracks = album.tracks.items;

    // Recupera le tracce della playlist (se presente playlistId)
    let playlistTrackUris = [];
    if (playlistId) {
      let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
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

    // HTML dell'album
    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8" />
        <title>Album - ${album.name}</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <div class="container">
          <h1>Album: ${album.name}</h1>
          <p>Artista: ${album.artists.map(a => a.name).join(', ')}</p>
          <img src="${album.images[0]?.url || ''}" alt="${album.name}" style="max-width: 300px;" />
          <h2>Tracce dell'album (${albumTracks.length})</h2>
          <ol>
            ${albumTracks.map(track => {
              const presente = playlistTrackUris.includes(track.uri);
              return `<li style="color: ${presente ? 'green' : 'red'}">
                        ${track.name} ${presente ? '✅' : '❌'}
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
