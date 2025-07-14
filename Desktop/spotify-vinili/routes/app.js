const express = require('express');
const { makeSpotifyRequest } = require('../services/spotifyService');
const { escapeHtml, validatePageNumber, validatePlaylistId, validateAlbumId, handleError } = require('../utils/helpers');
const router = express.Router();

// Main playlist view
router.get('/', async (req, res) => {
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

    // Helper function to format duration with better precision
    const formatDuration = (milliseconds) => {
      if (!milliseconds || milliseconds === 0) {
        return '0m';
      }
      
      const totalSeconds = Math.floor(milliseconds / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        return `${minutes}m`;
      } else {
        return `${seconds}s`;
      }
    };

    // Function to calculate playlist duration with better error handling
    const calculatePlaylistDuration = async (playlist) => {
      try {
        let totalDuration = 0;
        let totalTracks = 0;
        let tracksUrl = `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=50&fields=items(track(duration_ms,name)),next,total`;
        
        while (tracksUrl) {
          const tracksData = await makeSpotifyRequest(tracksUrl, accessToken);
          
          if (tracksData.items && Array.isArray(tracksData.items)) {
            for (const item of tracksData.items) {
              if (item && item.track && item.track.duration_ms) {
                totalDuration += item.track.duration_ms;
                totalTracks++;
              }
            }
          }
          
          tracksUrl = tracksData.next;
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return {
          ...playlist,
          totalDuration: totalDuration,
          calculatedTracks: totalTracks
        };
      } catch (error) {
        console.warn(`Error fetching tracks for playlist ${playlist.name} (${playlist.id}):`, error.message);
        return {
          ...playlist,
          totalDuration: 0,
          calculatedTracks: 0,
          error: true
        };
      }
    };

    // Get detailed info for each playlist with better concurrency control
    const batchSize = 5; // Process 5 playlists at a time to avoid rate limiting
    const playlistsWithDuration = [];
    
    for (let i = 0; i < playlists.length; i += batchSize) {
      const batch = playlists.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(playlist => calculatePlaylistDuration(playlist))
      );
      playlistsWithDuration.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < playlists.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Sort playlists by tracks (default sorting)
    playlistsWithDuration.sort((a, b) => (b.tracks?.total || 0) - (a.tracks?.total || 0));

    // Pagination
    const perPage = 6;
    const totalPages = Math.ceil(playlistsWithDuration.length / perPage);
    const paginatedPlaylists = playlistsWithDuration.slice((page - 1) * perPage, page * perPage);

    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Le tue Playlist Spotify</title>
        <link rel="stylesheet" href="/styles.css">
        <style>
          .duration-info {
            color: #666;
            font-size: 0.85em;
          }
          .duration-error {
            color: #dc3545;
            font-style: italic;
          }
          .duration-loading {
            color: #6c757d;
            font-style: italic;
          }
        </style>
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
              ${paginatedPlaylists.map(playlist => {
                const trackCount = playlist.tracks?.total || 0;
                const calculatedTracks = playlist.calculatedTracks || 0;
                const duration = playlist.totalDuration || 0;
                const hasError = playlist.error;
                
                let durationText;
                if (hasError) {
                  durationText = '<span class="duration-error">Durata non disponibile</span>';
                } else if (duration === 0 && trackCount > 0) {
                  durationText = '<span class="duration-loading">Calcolo durata...</span>';
                } else {
                  durationText = `<span class="duration-info">${formatDuration(duration)}</span>`;
                }
                
                return `
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
                              ${escapeHtml(playlist.owner?.display_name || 'Sconosciuto')} <br>
                              ${trackCount} tracce <br>
                              ${durationText}
                            </small>
                          </p>
                        </div>
                      </a>
                    </div>
                  </div>
                `;
              }).join('')}
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
router.get('/playlist/:id', async (req, res) => {
  const playlistId = req.params.id;
  
  if (!validatePlaylistId(playlistId)) {
    return handleError(res, 'ID playlist non valido', 400);
  }

  const accessToken = req.session.accessToken;
  const view = req.query.view === 'artist' ? 'artist' : 'album';
  const page = validatePageNumber(req.query.page);
  const perPage = 12;

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
          <div class="playlist-header" style="margin-bottom: 2rem;">
            <h1>${escapeHtml(playlist.name)}</h1>
            <p>${escapeHtml(playlist.description)}</p>
            <p>
                Di <strong>${escapeHtml(playlist.owner.display_name)}</strong> - 
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
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const totalDuration = `${hours > 0 ? `${hours}h ` : ''}${minutes}m ${totalSeconds}s`;

    
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
                    <span class="track-popularity">Popolarità: ${popularity}/100</span>
                    <span class="track-duration">${duration}</span>
                    <span class="track-status">${isInPlaylist ? '✔️' : '❌'}</span>
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

module.exports = router;
