require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
const querystring = require('querystring');

const app = express();
const port = process.env.PORT || 3000;

const clientId = process.env.SPOTIFY\_CLIENT\_ID;
const clientSecret = process.env.SPOTIFY\_CLIENT\_SECRET;
const redirectUri = process.env.REDIRECT\_URI;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(\_\_dirname, 'public')));
app.use(session({
secret: 'your-secret-key',
resave: false,
saveUninitialized: true,
cookie: { maxAge: 3600000, sameSite: 'lax' }
}));

function chunkArray(array, size) {
const chunks = \[];
for (let i = 0; i < array.length; i += size) {
chunks.push(array.slice(i, i + size));
}
return chunks;
}

async function getAccessToken(code) {
const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
const params = querystring.stringify({
code,
redirect\_uri: redirectUri,
grant\_type: 'authorization\_code',
});

const response = await axios.post('[https://accounts.spotify.com/api/token](https://accounts.spotify.com/api/token)', params, {
headers: {
Authorization: `Basic ${authHeader}`,
'Content-Type': 'application/x-www-form-urlencoded',
},
});

if (response.status === 200) {
return {
access\_token: response.data.access\_token,
refresh\_token: response.data.refresh\_token,
expires\_in: response.data.expires\_in,
};
} else {
throw new Error('Errore ottenendo token di accesso');
}
}

async function refreshAccessToken(refreshToken) {
const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
const params = querystring.stringify({
grant\_type: 'refresh\_token',
refresh\_token: refreshToken,
});

const response = await axios.post('[https://accounts.spotify.com/api/token](https://accounts.spotify.com/api/token)', params, {
headers: {
Authorization: `Basic ${authHeader}`,
'Content-Type': 'application/x-www-form-urlencoded',
},
});

if (response.status === 200) {
return {
access\_token: response.data.access\_token,
expires\_in: response.data.expires\_in,
};
} else {
throw new Error('Errore rinfrescando token');
}
}

async function checkAccessToken(req, res, next) {
const publicPaths = \['/start', '/login', '/callback'];
if (publicPaths.includes(req.path)) return next();

if (!req.session.accessToken) {
return res.redirect('/start');
}

// Potresti aggiungere qui controllo scadenza e refresh automatico del token

next();
}

function handleError(res, message) {
res.status(500).send(`     <html>       <head><title>Errore</title><link rel="stylesheet" href="/styles.css"></head>       <body>         <div class="container">           <h2>❌ Errore</h2>           <p>${message}</p>           <a href="/" class="btn btn-secondary">Torna alla home</a>         </div>       </body>     </html>
  `);
}

function getSpotifyAuthUrl() {
const scopes = 'playlist-read-private';
const params = new URLSearchParams({
client\_id: clientId,
response\_type: 'code',
redirect\_uri: redirectUri,
scope: scopes,
});
return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

app.get('/start', (req, res) => {
const authUrl = getSpotifyAuthUrl();
res.send(`     <html>       <head><title>Login Spotify</title><link rel="stylesheet" href="/styles.css"></head>       <body>         <div class="container">           <h1>Benvenuto</h1>           <p><a href="/login" class="btn btn-primary">Accedi con Spotify</a></p>         </div>       </body>     </html>
  `);
});

app.get('/login', (req, res) => {
const authUrl = getSpotifyAuthUrl();
res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
const code = req.query.code;
if (!code) return res.send('Nessun codice fornito');

try {
const tokens = await getAccessToken(code);
req.session.accessToken = tokens.access\_token;
req.session.refreshToken = tokens.refresh\_token;
res.redirect('/');
} catch (err) {
console.error('Errore token:', err);
res.send('Errore autenticazione Spotify');
}
});

app.use(checkAccessToken);

app.get('/', async (req, res) => {
const accessToken = req.session.accessToken;
try {
let playlists = \[];
let nextUrl = '[https://api.spotify.com/v1/me/playlists?limit=50](https://api.spotify.com/v1/me/playlists?limit=50)';

```
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
```

} catch (err) {
console.error('Errore playlist:', err.message);
handleError(res, 'Impossibile recuperare le playlist. Riprova più tardi.');
}
});

app.get('/playlist/\:id', async (req, res) => {
const accessToken = req.session.accessToken;
const playlistId = req.params.id;
const page = parseInt(req.query.page) || 1;
const itemsPerPage = 10;

try {
// Recupera le tracce della playlist con paginazione
let allTracks = \[];
let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

```
while (nextUrl) {
  const { data } = await axios.get(nextUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  allTracks = allTracks.concat(data.items);
  nextUrl = data.next;
}

// Filtra solo tracce con album e tipo "track"
const filteredTracks = allTracks
  .filter(item => item.track && item.track.album && item.track.type === 'track');

// Raggruppa tracce per album
const albumsMap = new Map();

filteredTracks.forEach(item => {
  const album = item.track.album;
  const albumId = album.id;

  if (!albumsMap.has(albumId)) {
    albumsMap.set(albumId, {
      albumId,
      name: album.name,
      artist: album.artists.map(a => a.name).join(', '),
      totalTracks: album.total_tracks,
      images: album.images,
      tracksInPlaylist: 0,
    });
  }
  const albumData = albumsMap.get(albumId);
  albumData.tracksInPlaylist++;
});

// Converti in array e ordina per nome album
const albumsArray = Array.from(albumsMap.values())
  .sort((a, b) => a.name.localeCompare(b.name));

// Paginazione
const totalPages = Math.ceil(albumsArray.length / itemsPerPage);
const startIndex = (page - 1) * itemsPerPage;
const endIndex = startIndex + itemsPerPage;
const albumsPage = albumsArray.slice(startIndex, endIndex);

// Costruisci HTML della pagina
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
    <h1>Album nella Playlist</h1>
    <ul class="album-list">
      ${albumsPage.map(album => `
        <li class="album-item">
          <a href="/album/${album.albumId}?playlistId=${playlistId}">
            <img src="${album.images?.[0]?.url || ''}" alt="${album.name}" style="width:100px;">
            <div>
              <strong>${album.name}</strong><br>
              <em>${album.artist}</em><br>
              Tracce in playlist: ${album.tracksInPlaylist} / ${album.totalTracks}
            </div>
          </a>
        </li>
      `).join('')}
    </ul>

    <div class="pagination">
      ${page > 1 ? `<a href="/playlist/${playlistId}?page=${page - 1}" class="btn btn-primary">⬅️ Precedente</a>` : ''}
      ${page < totalPages ? `<a href="/playlist/${playlistId}?page=${page + 1}" class="btn btn-primary">Successivo ➡️</a>` : ''}
    </div>

    <p><a href="/" class="btn btn-secondary">🏠 Torna alle playlist</a></p>
  </div>
</body>
</html>`;

res.send(html);
```

} catch (err) {
console.error('Errore tracce playlist:', err.message);
handleError(res, 'Impossibile recuperare le tracce della playlist. Riprova più tardi.');
}
});

app.get('/album/\:id', async (req, res) => {
const accessToken = req.session.accessToken;
const albumId = req.params.id;
const playlistId = req.query.playlistId;

try {
// Ottieni dettagli album
const { data: albumData } = await axios.get(`https://api.spotify.com/v1/albums/${albumId}`, {
headers: { Authorization: `Bearer ${accessToken}` },
});

```
// Ottieni tutte le tracce della playlist
let playlistTracks = [];
let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;

while (nextUrl) {
  const { data } = await axios.get(nextUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  playlistTracks.push(...data.items);
  nextUrl = data.next;
}

// Crea set degli id delle tracce nella playlist
const playlistTrackIds = new Set(
  playlistTracks.map(item => item.track?.id).filter(Boolean)
);

// Lista tracce album con indicazione se presenti in playlist
const tracks = albumData.tracks.items.map(track => ({
  id: track.id,
  name: track.name,
  isInPlaylist: playlistTrackIds.has(track.id),
  duration_ms: track.duration_ms,
  track_number: track.track_number,
  artists: track.artists.map(a => a.name).join(', '),
}));

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Dettagli Album: ${albumData.name}</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="container">
    <h1>Album: ${albumData.name}</h1>
    <h3>Artista: ${albumData.artists.map(a => a.name).join(', ')}</h3>
    <img src="${albumData.images?.[0]?.url || ''}" alt="${albumData.name}" style="max-width:300px;">
    <ul class="tracklist">
      ${tracks.map(t => `
        <li class="${t.isInPlaylist ? 'in-playlist' : 'not-in-playlist'}">
          ${t.track_number}. ${t.name} - ${t.artists} 
          ${t.isInPlaylist ? '✅' : '❌'}
        </li>
      `).join('')}
    </ul>
    <a href="/playlist/${playlistId}" class="btn btn-secondary">🔙 Torna all'Album nella Playlist</a>
  </div>
</body>
</html>`;

res.send(html);
```

} catch (err) {
console.error('Errore recupero dettagli album:', err.message);
handleError(res, 'Impossibile recuperare i dettagli dell'album. Riprova più tardi.');
}
});
