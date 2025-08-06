const { escapeHtml, formatDuration } = require('../utils/helpers');

const renderAlbumDetailPage = (viewData) => {
  const { album, tracksDetails, playlistId, playlistTrackUris } = viewData;
  
  const totalDurationMs = album.tracks.items.reduce((total, track) => total + (track.duration_ms || 0), 0);
  const totalDuration = formatDuration(totalDurationMs);
  
  const tracksInPlaylistCount = album.tracks.items.filter(track => playlistTrackUris.has(track.uri)).length;
  const completionPercentage = album.total_tracks > 0 ?
    Math.round((tracksInPlaylistCount / album.total_tracks) * 100) : 0;

  return `
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
                  ${tracksInPlaylistCount}/${album.total_tracks} nella playlist (${completionPercentage}%)
                </span>
              </div>
            ` : ''}
          </div>
        </div>

        <h3>Tracklist:</h3>
        <ol class="tracklist">
          ${album.tracks.items.map((track, index) => {
            const isInPlaylist = playlistTrackUris.has(track.uri);
            const duration = formatDuration(track.duration_ms || 0).replace('m', ':').replace('h ', ':').replace('s', '');

            const trackDetail = tracksDetails.tracks.find(t => t.id === track.id);
            const popularity = trackDetail ? trackDetail.popularity : 0;
            
            return `
              <li class="track-item ${isInPlaylist ? 'in-playlist' : ''}">
                <div class="track-info">
                  <span class="track-number">${track.track_number}</span>
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
};

module.exports = {
    renderAlbumDetailPage,
};
