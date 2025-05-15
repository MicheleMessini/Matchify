const express = require('express');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
const querystring = require('querystring');
const app = express();
const port = 3000;

const clientId = '24cac5157cc94e79b3410febb9f69c7e';
const clientSecret = '0501a5cad0b24362a141383dab68b055';
const redirectUri = 'http://localhost:3000/callback';

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
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
    };
  } else {
    throw new Error('Errore nell\'ottenere il token di accesso');
  }
}

// Middleware corretto: esclude le rotte pubbliche per evitare loop redirect
function checkAccessToken(req, res, next) {
  const publicPaths = ['/start', '/login', '/callback'];
  if (publicPaths.includes(req.path)) {
    return next();
  }
  if (!req.session.accessToken) {
    return res.redirect('/start');
  }
  next();
}

function handleError(res, errorMessage) {
  res.status(500).send(`
    <html>
      <head><title>Errore</title><link rel="stylesheet" href="/styles.css"></head>
      <body>
        <div class="container">
          <h2>❌ Errore</h2>
          <p>${errorMessage}</p>
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

app.get('/start', (req, res) => {
  const authUrl = getSpotifyAuthUrl();
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

app.get('/login', (req, res) => {
  const authUrl = getSpotifyAuthUrl();
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  if (!code) return res.send('Nessun codice fornito');

  try {
    const { access_token, refresh_token } = await getAccessToken(code);
    req.session.accessToken = access_token;
    req.session.refreshToken = refresh_token;
    res.redirect('/');
  } catch (err) {
    console.error('Errore ottenendo token:', err);
    res.send('Errore durante l\'autenticazione');
  }
});

app.use(checkAccessToken);

app.get('/', async (req, res) => {
  const accessToken = req.session.accessToken;

  try {
    let playlists = [];
    let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=50';

    while (nextUrl) {
      const response = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.status !== 200) throw new Error(`Errore HTTP: ${response.status}`);

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
        <h1>🎵 Le tue Playlist Spotify</h1>
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
          ${page > 1 ? `<a href="/?page=${page - 1}" class="btn btn-primary">⬅️ Precedente</a>` : ''}
          ${page < totalPages ? `<a href="/?page=${page + 1}" class="btn btn-primary">Successivo ➡️</a>` : ''}
        </div>
      </div>
    </body>
    </html>`;

    res.send(html);
  } catch (err) {
    console.error('Errore recupero playlist:', err.message);
    handleError(res, 'Impossibile recuperare le playlist. Riprova più tardi.');
  }
});

app.get('/playlist/:id', async (req, res) => {
  const accessToken = req.session.accessToken;
  const playlistId = req.params.id;
  const page = parseInt(req.query.page) || 1;
  const perPage = 15;

  try {
    let tracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;

    while (nextUrl) {
      const { data } = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      tracks.push(...data.items);
      nextUrl = data.next;
    }

    // Raggruppa tracce per album, escludendo singoli e album con solo una traccia
    const albumMap = new Map();

    for (const item of tracks) {
      const track = item.track;
      if (!track || !track.album) continue;
      if (track.album.album_type !== 'album' || track.album.total_tracks <= 1) continue;

      const albumId = track.album.id;
      if (!albumMap.has(albumId)) {
        albumMap.set(albumId, {
          id: albumId,
          name: track.album.name,
          artist: track.album.artists.map(a => a.name).join(', '),
          image: track.album.images?.[0]?.url || '',
          totalTracks: track.album.total_tracks,
          trackIds: new Set(),
        });
      }
      albumMap.get(albumId).trackIds.add(track.id);
    }

    const albums = Array.from(albumMap.values()).map(a => ({
      ...a,
      trackCount: a.trackIds.size,
      percentage: (a.trackIds.size / a.totalTracks * 100).toFixed(1),
    }));

    albums.sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name));

    const totalPages = Math.ceil(albums.length / perPage);
    const paginated = albums.slice((page - 1) * perPage, page * perPage);

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Album nella Playlist</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <div class="container">
        <h1>🎧 Album nella Playlist</h1>
        <div class="row">
          ${paginated.map(album => `
            <div class="col-md-4">
              <div class="card">
                <a href="/album/${album.id}?playlistId=${playlistId}">
                  <img src="${album.image}" class="card-img-top" alt="${album.name}">
                </a>
                <div class="card-body">
                  <h5>${album.name}</h5>
                  <p>${album.artist}</p>
                  <p>${album.trackCount}/${album.totalTracks} tracce presenti (${album.percentage}%)</p>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="pagination">
          ${page > 1 ? `<a href="/playlist/${playlistId}?page=${page - 1}" class="btn btn-primary">⬅️ Precedente</a>` : ''}
          ${page < totalPages ? `<a href="/playlist/${playlistId}?page=${page + 1}" class="btn btn-primary">Successivo ➡️</a>` : ''}
        </div>
        <a href="/" class="btn btn-secondary">🔙 Torna alle Playlist</a>
      </div>
    </body>
    </html>`;

    res.send(html);
  } catch (err) {
    console.error('Errore recupero tracce playlist:', err.message);
    handleError(res, 'Impossibile recuperare le tracce della playlist. Riprova più tardi.');
  }
});

app.get('/album/:id', async (req, res) => {
  const accessToken = req.session.accessToken;
  const albumId = req.params.id;
  const playlistId = req.query.playlistId;

  if (!playlistId) return handleError(res, 'Parametro playlistId mancante nel link.');

  try {
    // Ottieni dettagli dell'album
    const { data: album } = await axios.get(`https://api.spotify.com/v1/albums/${albumId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Ottieni tutte le tracce della playlist
    let playlistTrackIds = new Set();
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;

    while (nextUrl) {
      const { data } = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      for (const item of data.items) {
        if (item.track?.id) {
          playlistTrackIds.add(item.track.id);
        }
      }

      nextUrl = data.next;
    }

    // Prepara la lista delle tracce dell’album e verifica la presenza
    const trackList = album.tracks.items.map(t => ({
      number: t.track_number,
      name: t.name,
      inPlaylist: playlistTrackIds.has(t.id),
    }));

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${album.name} - Dettagli Album</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <div class="container">
        <h1>${album.name} - ${album.artists.map(a => a.name).join(', ')}</h1>
        <img src="${album.images?.[0]?.url}" alt="${album.name}" style="max-width: 300px; margin-bottom: 1em;">
        <ul>
          ${trackList.map(t => `
            <li style="color: ${t.inPlaylist ? 'green' : 'red'};">
              ${t.inPlaylist ? '✅' : '❌'} Traccia ${t.number}: ${t.name}
            </li>
          `).join('')}
        </ul>
        <a href="/playlist/${playlistId}" class="btn btn-secondary">⬅️ Torna alla playlist</a>
      </div>
    </body>
    </html>
    `;

    res.send(html);
  } catch (err) {
    console.error('Errore nei dettagli dell\'album:', err.message);
    handleError(res, 'Errore durante il caricamento dei dettagli dell\'album.');
  }
});

app.listen(port, () => {
  console.log(`App in ascolto su http://localhost:${port}`);
});
