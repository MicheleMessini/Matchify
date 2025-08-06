const { escapeHtml, formatDuration } = require('../utils/helpers');

/**
 * Genera l'HTML per la visualizzazione di un singolo brano nella tracklist.
 * @param {object} track - L'oggetto traccia dall'API di Spotify.
 * @param {object} trackDetail - L'oggetto con i dettagli extra della traccia (es. popolarità).
 * @param {Set<string>} playlistTrackUris - Un Set contenente gli URI dei brani nella playlist.
 * @returns {string} - La stringa HTML per il singolo <li>.
 */
const renderTracklistItem = (track, trackDetail, playlistTrackUris) => {
  const isInPlaylist = playlistTrackUris.has(track.uri);
  
  // Formatta la durata nel formato "m:ss"
  const minutes = Math.floor((track.duration_ms || 0) / 60000);
  const seconds = Math.floor(((track.duration_ms || 0) % 60000) / 1000);
  const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  const popularity = trackDetail ? trackDetail.popularity : 0;
  
  return `
    <li class="track-item ${isInPlaylist ? 'in-playlist' : ''}">
      <div class="track-info">
        <span class="track-number">${track.track_number}</span>
        <span class="track-name">${escapeHtml(track.name)}</span>
        <span class="track-artists d-none d-md-inline"> - ${escapeHtml(track.artists.map(a => a.name).join(', '))}</span>
      </div>
      <div class="track-details">
        <span class="track-popularity" title="Popolarità su Spotify (0-100)">
          <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0-1.5A5.5 5.5 0 1 0 8 2.5a5.5 5.5 0 0 0 0 11"/></svg>
          ${popularity}
        </span>
        <span class="track-duration">${duration}</span>
        <span class="track-status" title="${isInPlaylist ? 'Nella playlist' : 'Non nella playlist'}">${isInPlaylist ? '✔️' : '❌'}</span>
      </div>
    </li>
  `;
};

/**
 * Genera l'HTML completo per la pagina di dettaglio di un album.
 * @param {object} viewData - Un oggetto contenente tutti i dati necessari per la vista.
 * @returns {string} - L'intera pagina HTML come stringa.
 */
const renderAlbumDetailPage = (viewData) => {
  const { album, tracksDetails, playlistId, playlistTrackUris } = viewData;
  
  // Calcola i dati derivati necessari per la visualizzazione
  const totalDurationMs = album.tracks.items.reduce((total, track) => total + (track.duration_ms || 0), 0);
  const totalDurationText = formatDuration(totalDurationMs);
  
  const tracksInPlaylistCount = album.tracks.items.filter(track => playlistTrackUris.has(track.uri)).length;
  const completionPercentage = album.total_tracks > 0 ?
    Math.round((tracksInPlaylistCount / album.total_tracks) * 100) : 0;
  
  // Costruisce l'HTML completo
  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Album: ${escapeHtml(album.name)}</title>
      <link rel="stylesheet" href="/styles.css">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;" />
    </head>
    <body>
      <div class="container">
        <div class="album-header">
          <img src="${escapeHtml(album.images?.[0]?.url || '/placeholder.png')}" 
               alt="Copertina di ${escapeHtml(album.name)}" 
               class="album-cover"
               onerror="this.src='/placeholder.png'">
          <div class="album-info">
            <h1>${escapeHtml(album.name)}</h1>
            <h2>${album.artists.map(a => escapeHtml(a.name)).join(', ')}</h2>
            <p>
              <strong>Data di uscita:</strong> ${new Date(album.release_date).toLocaleDateString('it-IT')} | 
              <strong>Tracce:</strong> ${album.total_tracks} | 
              <strong>Durata:</strong> ${totalDurationText}
            </p>
            ${playlistId ? `
              <div class="playlist-completion-badge">
                <span class="badge ${completionPercentage >= 50 ? 'bg-success' : completionPercentage >= 25 ? 'bg-warning' : 'bg-secondary'}">
                  ${tracksInPlaylistCount}/${album.total_tracks} nella playlist (${completionPercentage}%)
                </span>
              </div>
            ` : ''}
          </div>
        </div>

        <h3>Tracklist:</h3>
        <ol class="tracklist">
          ${album.tracks.items.map(track => {
            const trackDetail = tracksDetails.tracks.find(t => t.id === track.id);
            return renderTracklistItem(track, trackDetail, playlistTrackUris);
          }).join('')}
        </ol>

        <div class="text-center mt-4">
          <button onclick="history.back()" class="btn btn-secondary">← Torna Indietro</button>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  renderAlbumDetailPage,
};
