const express = require('express');
const { makeSpotifyRequest } = require('../services/spotifyService');
const { escapeHtml, validatePageNumber, validatePlaylistId, validateAlbumId, handleError } = require('../utils/helpers');
const router = express.Router();
const NodeCache = require('node-cache');

// --- NUOVO: Inizializzazione della Cache ---
// I dati verranno conservati per 15 minuti (900 secondi)
const appCache = new NodeCache({ stdTTL: 900 });

// Constants
const PLAYLIST_RATE_LIMIT_DELAY = 100;
const PLAYLISTS_PER_PAGE = 6;
const ALBUMS_PER_PAGE = 12;
const MAX_ARTISTS_DISPLAYED = 50;

// Helper functions
const formatDuration = (milliseconds) => {
  if (!milliseconds || milliseconds === 0) return '0m';
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${Math.floor(totalSeconds % 60)}s`;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchAllPlaylistTracks = async (playlistId, accessToken) => {
  let tracks = [];
  let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=items(track(duration_ms,name,id)),next,total`;
  
  while (nextUrl) {
    const tracksData = await makeSpotifyRequest(nextUrl, accessToken);
    
    if (tracksData.items && Array.isArray(tracksData.items)) {
      tracks.push(...tracksData.items.filter(item => item?.track?.duration_ms));
    }
    
    nextUrl = tracksData.next;
    if (nextUrl) await delay(PLAYLIST_RATE_LIMIT_DELAY);
  }
  
  return tracks;
};

// --- MODIFICATO: Funzione con cache ---
const calculatePlaylistDuration = async (playlist, accessToken) => {
  const cacheKey = `duration:${playlist.id}`;
  const cachedResult = appCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult; // Restituisce il risultato dalla cache se presente
  }

  try {
    const tracks = await fetchAllPlaylistTracks(playlist.id, accessToken);
    const totalDuration = tracks.reduce((sum, item) => sum + item.track.duration_ms, 0);
    
    const result = {
      ...playlist,
      totalDuration,
      calculatedTracks: tracks.length,
      error: false
    };
    appCache.set(cacheKey, result); // Salva il risultato in cache
    return result;
  } catch (error) {
    console.warn(`Error calculating duration for playlist ${playlist.name}:`, error.message);
    return { ...playlist, totalDuration: 0, calculatedTracks: 0, error: true };
  }
};

const fetchAllPlaylists = async (accessToken) => {
  // Anche qui si potrebbe aggiungere una cache per utente se si avesse l'ID utente
  let playlists = [];
  let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=50';
  
  while (nextUrl) {
    const data = await makeSpotifyRequest(nextUrl, accessToken);
    playlists.push(...data.items.filter(p => p?.id));
    nextUrl = data.next;
  }
  
  return playlists;
};

// --- ELIMINATA LA NECESSITÀ di processPlaylistsInBatches sulla rotta principale ---

// --- MODIFICATO: `renderPlaylistCard` ora ha un placeholder e un data-attribute ---
const renderPlaylistCard = (playlist) => {
  const trackCount = playlist.tracks?.total || 0;
  
  return `
    <div class="col-md-4 mb-4" data-playlist-id="${escapeHtml(playlist.id)}">
      <div class="card h-100">
        <a href="/playlist/${escapeHtml(playlist.id)}" class="card-link">
          <img src="${escapeHtml(playlist.images?.[0]?.url || '/placeholder.png')}" 
               alt="${escapeHtml(playlist.name)}" 
               class="card-img-top"
               onerror="this.src='/placeholder.png'">
          <div class="card-body">
            <h5 class="card-title">${escapeHtml(playlist.name)}</h5>
            <p class="card-text">
              <small class="text-muted">
                ${escapeHtml(playlist.owner?.display_name || 'Sconosciuto')} <br>
                ${trackCount} tracce <br>
                <span class="duration-text duration-loading">Calcolo durata...</span>
              </small>
            </p>
          </div>
        </a>
      </div>
    </div>
  `;
};


const renderPagination = (currentPage, totalPages, baseUrl) => {
  if (totalPages <= 1) return '';
  
  return `
    <div class="pagination">
      ${currentPage > 1 ? `<a href="${baseUrl}page=${currentPage - 1}" class="btn btn-primary">« Precedente</a>` : ''}
      <span class="page-info">Pagina ${currentPage} di ${totalPages}</span>
      ${currentPage < totalPages ? `<a href="${baseUrl}page=${currentPage + 1}" class="btn btn-primary">Successivo »</a>` : ''}
    </div>
  `;
};

// --- MODIFICATO: La vista principale ora carica istantaneamente ---
router.get('/', async (req, res) => {
  const accessToken = req.session.accessToken;
  if (!accessToken) {
    return res.redirect('/start');
  }

  const page = validatePageNumber(req.query.page);
  
  try {
    const playlists = await fetchAllPlaylists(accessToken);
    
    playlists.sort((a, b) => (b.tracks?.total || 0) - (a.tracks?.total || 0));

    const totalPages = Math.ceil(playlists.length / PLAYLISTS_PER_PAGE);
    const paginatedPlaylists = playlists.slice(
      (page - 1) * PLAYLISTS_PER_PAGE, 
      page * PLAYLISTS_PER_PAGE
    );

    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Le tue Playlist Spotify</title>
        <link rel="stylesheet" href="/styles.css">
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;" />
        <style>
          .duration-info { color: #666; font-size: 0.85em; }
          .duration-error { color: #dc3545; font-style: italic; }
          .duration-loading { color: #6c757d; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h1>Le tue Playlist</h1>
          </div>
          
          ${playlists.length === 0 ? `
            <div class="text-center">
              <p>Non hai ancora nessuna playlist. Creane una su Spotify!</p>
              <a href="/start" class="btn btn-primary">Ricarica</a>
            </div>
          ` : `
            <div class="row">
              ${paginatedPlaylists.map(renderPlaylistCard).join('')}
            </div>
          `}
          
          ${renderPagination(page, totalPages, '/?')}
        </div>

        <!-- NUOVO: Script per caricare le durate asincronamente -->
        <script>
          document.addEventListener('DOMContentLoaded', () => {
            const playlistCards = document.querySelectorAll('[data-playlist-id]');
    
            playlistCards.forEach(card => {
              const playlistId = card.dataset.playlistId;
              const durationElement = card.querySelector('.duration-text');
    
              fetch('/api/duration/' + playlistId)
                .then(response => {
                  if (!response.ok) throw new Error('API Response not OK');
                  return response.json();
                })
                .then(data => {
                  if (data && data.durationText) {
                    durationElement.textContent = data.durationText;
                    durationElement.classList.remove('duration-loading');
                    durationElement.classList.add('duration-info');
                  } else {
                    throw new Error('Invalid data format');
                  }
                })
                .catch(error => {
                  console.warn('Could not fetch duration for ' + playlistId, error);
                  durationElement.textContent = 'Durata non disp.';
                  durationElement.classList.remove('duration-loading');
                  durationElement.classList.add('duration-error');
                });
            });
          });
        </script>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (err) {
    console.error('Error fetching playlists:', err.message);
    if (err.message === 'UNAUTHORIZED') {
      req.session.destroy(); return res.redirect('/start');
    }
    if (err.message === 'RATE_LIMITED') {
      return handleError(res, 'Troppe richieste. Riprova tra qualche minuto.', 429);
    }
    handleError(res, 'Impossibile recuperare le playlist. Riprova più tardi.');
  }
});

// --- NUOVA ROTTA API ---
// Questa rotta viene chiamata dallo script frontend per ogni playlist.
router.get('/api/duration/:playlistId', async (req, res) => {
    try {
        const accessToken = req.session.accessToken;
        if (!accessToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { playlistId } = req.params;
        if (!validatePlaylistId(playlistId)) {
            return res.status(400).json({ error: 'Invalid Playlist ID' });
        }

        // Crea un oggetto 'stub' per la funzione, che ora è arricchita con cache
        const playlistStub = { id: playlistId };
        const result = await calculatePlaylistDuration(playlistStub, accessToken);

        if (result.error) {
            throw new Error('Calculation failed');
        }
        
        // Restituisce la durata formattata in JSON
        res.json({ durationText: formatDuration(result.totalDuration) });

    } catch (error) {
        console.warn(`API error for duration on ${req.params.playlistId}:`, error.message);
        res.status(500).json({ error: 'Could not calculate duration' });
    }
});


// Il resto del file (pagine di dettaglio) rimane invariato
// Playlist detail view
router.get('/playlist/:id', async (req, res) => {
  // ... NESSUNA MODIFICA A QUESTA ROTTA ...
  const playlistId = req.params.id;
  
  if (!validatePlaylistId(playlistId)) {
    return handleError(res, 'ID playlist non valido', 400);
  }

  const accessToken = req.session.accessToken;
  if (!accessToken) {
    return res.redirect('/start');
  }

  const view = req.query.view === 'artist' ? 'artist' : 'album';
  const page = validatePageNumber(req.query.page);

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
      tracks.push(...data.items.filter(item => item?.track));
      nextUrl = data.next;
    }

    // Calculate statistics
    const totalTracks = tracks.length;
    const totalDurationMs = tracks.reduce((total, item) => total + (item.track?.duration_ms || 0), 0);
    const durationText = formatDuration(totalDurationMs);

    // Get unique counts
    const uniqueArtists = new Set();
    const uniqueAlbums = new Set();
    
    tracks.forEach(item => {
      if (item.track?.artists) {
        item.track.artists.forEach(artist => {
          if (artist?.id) uniqueArtists.add(artist.id);
        });
      }
      if (item.track?.album?.id) {
        uniqueAlbums.add(item.track.album.id);
      }
    });

    let contentHtml = '';

    if (view === 'artist') {
      // Artist view logic
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

      // Get artist images in batches
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
        .slice(0, MAX_ARTISTS_DISPLAYED);
    
      contentHtml = `
        <h2 class="mb-4">Top ${MAX_ARTISTS_DISPLAYED} Artisti nella playlist</h2>
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
                  <p class="card-text">
                    <span class="badge bg-primary">${artist.trackCount} brani</span>
                  </p>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      // Album view logic
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

      const totalPages = Math.ceil(albums.length / ALBUMS_PER_PAGE);
      const paginatedAlbums = albums.slice((page - 1) * ALBUMS_PER_PAGE, page * ALBUMS_PER_PAGE);

      contentHtml = `
        <h2 class="mb-4">Album nella playlist (${albums.length})</h2>
        <div class="row">
        ${paginatedAlbums.map(album => `
          <div class="col-md-4 mb-4">
            <div class="card h-100">
              <a href="/album/${escapeHtml(album.id)}?playlistId=${escapeHtml(playlistId)}" 
                 class="card-link">
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
                    <span class="badge ${album.percentage >= 50 ? 'bg-success' : 
                                         album.percentage >= 25 ? 'bg-warning' : 'bg-secondary'}">
                      ${album.tracksPresent}/${album.totalTracks} (${album.percentage}%)
                    </span>
                  </p>
                </div>
              </a>
            </div>
          </div>
        `).join('')}
        </div>
        
        ${renderPagination(page, totalPages, `/playlist/${encodeURIComponent(playlistId)}?view=album&`)}
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
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;" />
      </head>
      <body>
        <div class="container">
          <div class="playlist-header" style="margin-bottom: 2rem;">
            <h1>${escapeHtml(playlist.name)}</h1>
            <p>${escapeHtml(playlist.description || '')}</p>
            <p>
                Di <strong>${escapeHtml(playlist.owner?.display_name || 'Sconosciuto')}</strong> - 
                ${totalTracks} brani, circa ${durationText}
            </p>
            <p>
                <span class="badge bg-info">${uniqueAlbums.size} album unici</span>
                <span class="badge bg-info">${uniqueArtists.size} artisti unici</span>
            </p>
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
router.get('/album/:id', async (req, res) => {
  // ... NESSUNA MODIFICA A QUESTA ROTTA ...
  const albumId = req.params.id;
  
  if (!validateAlbumId(albumId)) {
    return handleError(res, 'ID album non valido', 400);
  }

  const accessToken = req.session.accessToken;
  if (!accessToken) {
    return res.redirect('/start');
  }

  const playlistId = req.query.playlistId;
  
  try {
    // Get album details
    const album = await makeSpotifyRequest(
      `https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}`,
      accessToken
    );
    
    // Get detailed track info
    const trackIds = album.tracks.items.map(track => track.id).filter(Boolean).join(',');
    const tracksDetails = trackIds ? await makeSpotifyRequest(
      `https://api.spotify.com/v1/tracks?ids=${trackIds}`,
      accessToken
    ) : { tracks: [] };
    
    // Calculate total duration
    const totalDurationMs = album.tracks.items.reduce((total, track) => total + (track.duration_ms || 0), 0);
    const totalDuration = formatDuration(totalDurationMs);
    
    // Get playlist tracks if playlistId provided
    let playlistTrackUris = [];
    if (playlistId && validatePlaylistId(playlistId)) {
      let nextUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=50&fields=items(track(uri)),next`;
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
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;" />
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
                  <span class="badge ${completionPercentage >= 50 ? 'bg-success' : completionPercentage >= 25 ? 'bg-warning' : 'bg-secondary'}">
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
              const minutes = Math.floor((track.duration_ms || 0) / 60000);
              const seconds = Math.floor(((track.duration_ms || 0) % 60000) / 1000);
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
                    <span class="track-popularity">Popolarità: ${popularity}/100</span>
                    <span class="track-duration">${duration}</span>
                    <span class="track-status">${isInPlaylist ? '✔️' : '❌'}</span>
                  </div>
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
    if (err.message === 'UNAUTHORIZED') {
      req.session.destroy();
      return res.redirect('/start');
    }
    if (err.response?.status === 404) {
      return handleError(res, 'Album non trovato', 404);
    }
    handleError(res, 'Errore nel recupero dei dettagli dell\'album');
  }
});


module.exports = router;
