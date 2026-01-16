const { escapeHtml, formatDuration } = require('../utils/helpers');

/**
 * Genera l'HTML per la pagina di dettaglio di un album in stile Spotify.
 */
const renderAlbumDetailPage = (viewData) => {
  const { album, playlistTrackUris, playlistId } = viewData;
  const totalDurationText = formatDuration(album.tracks.items.reduce((total, track) => total + (track.duration_ms || 0), 0));
  const tracksInPlaylistCount = album.tracks.items.filter(track => playlistTrackUris.has(track.uri)).length;
  
  const renderTrack = (track) => {
    const isInPlaylist = playlistTrackUris.has(track.uri);
    const duration = formatDuration(track.duration_ms || 0);
    
    return `
      <li class="track-item ${isInPlaylist ? 'playing' : ''}">
        <span class="track-number">${track.track_number}</span>
        <div class="track-info">
          <div class="track-name">${escapeHtml(track.name)}</div>
          <div class="track-artists">
            ${escapeHtml(track.artists.map(a => a.name).join(', '))}
          </div>
        </div>
        <div class="track-album">
          ${escapeHtml(album.name)}
        </div>
        <div class="track-duration">
          ${isInPlaylist ? `<span title="Presente nella playlist">✓</span>` : ''}
          ${duration}
        </div>
      </li>
    `;
  };
  
  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(album.name)} - Spotify</title>
      <link rel="stylesheet" href="/album.css">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self'; img-src 'self' data: https:;">
    </head>
    <body>
      <div class="container">
        
        <header class="album-header">
          <img src="${escapeHtml(album.images?.[0]?.url || '/placeholder.png')}" 
               alt="${escapeHtml(album.name)}"
               class="album-cover" 
               onerror="this.src='/placeholder.png'">
          <div class="album-info">
            <p class="album-type">Album</p>
            <h1>${escapeHtml(album.name)}</h1>
            <p class="text-muted">
              ${album.artists.map(a => escapeHtml(a.name)).join(', ')}
            </p>
            <p>
              ${new Date(album.release_date).getFullYear()} • 
              ${album.total_tracks} bran${album.total_tracks === 1 ? 'o' : 'i'}, 
              ${totalDurationText}
            </p>
            ${playlistId ? `<p class="text-primary" style="margin-top: 0.5rem;">${tracksInPlaylistCount} di ${album.total_tracks} brani nella playlist</p>` : ''}
          </div>
        </header>
        
        <main>
          <div class="track-header">
            <div>#</div>
            <div>Titolo</div>
            <div>Album</div>
            <div style="text-align: right;">⏱</div>
          </div>
          <ol class="tracklist">
            ${album.tracks.items.map(renderTrack).join('')}
          </ol>
        </main>
        
        <footer class="text-center">
          <a href="javascript:history.back()" class="btn btn-secondary">&larr; Torna Indietro</a>
        </footer>
        
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  renderAlbumDetailPage,
};
