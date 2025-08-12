// Import delle funzioni strettamente necessarie.
const { escapeHtml, formatDuration } = require('../utils/helpers');

/**
 * Genera l'HTML per la pagina di dettaglio di un album (versione semplificata).
 * @param {object} viewData - Dati necessari per la vista.
 * @returns {string} - L'intera pagina HTML come stringa.
 */
const renderAlbumDetailPage = (viewData) => {
  const { album, playlistTrackUris, playlistId } = viewData;

  // Calcola le statistiche essenziali.
  const totalDurationText = formatDuration(album.tracks.items.reduce((total, track) => total + (track.duration_ms || 0), 0));
  const tracksInPlaylistCount = album.tracks.items.filter(track => playlistTrackUris.has(track.uri)).length;

  /**
   * Helper interno per renderizzare una singola traccia in modo minimale.
   */
  const renderTrack = (track) => {
    const isInPlaylist = playlistTrackUris.has(track.uri);
    const duration = formatDuration(track.duration_ms || 0);

    // Usa le classi CSS base che hai già (.track-item) ma con meno elementi.
    return `
      <li class="track-item ${isInPlaylist ? 'playing' : ''}">
        <span class="track-number">${track.track_number}</span>
        <div>
          <div class="track-name">${escapeHtml(track.name)}</div>
          <div class="text-muted" style="font-size: var(--fs-sm);">
            ${escapeHtml(track.artists.map(a => a.name).join(', '))}
          </div>
        </div>
        <div class="track-duration">
          ${duration}
          ${isInPlaylist ? `<span title="Presente nella playlist"> ✔️</span>` : ''}
        </div>
      </li>
    `;
  };

  // Costruzione della pagina HTML completa.
  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Album: ${escapeHtml(album.name)}</title>
      <link rel="stylesheet" href="/styles.css">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self'; img-src 'self' data: https:;">
    </head>
    <body>
      <div class="container">
        
        <header style="display: flex; gap: var(--space-lg); align-items: center; margin-bottom: var(--space-xl);">
          <img src="${escapeHtml(album.images?.[0]?.url || '/placeholder.png')}" 
               alt="Copertina di ${escapeHtml(album.name)}"
               class="album-cover" 
               style="width: 150px; height: 150px; border-radius: var(--radius-base);"
               onerror="this.src='/placeholder.png'">
          <div>
            <h1>${escapeHtml(album.name)}</h1>
            <p class="text-muted" style="font-size: var(--fs-lg); margin-top: -0.5rem;">
              di ${album.artists.map(a => escapeHtml(a.name)).join(', ')}
            </p>
            <p>${new Date(album.release_date).getFullYear()} &bull; ${album.total_tracks} tracce &bull; ${totalDurationText}</p>

            <!-- Mostra il contatore solo se siamo arrivati da una playlist -->
            ${playlistId ? `
              <p class="text-primary">${tracksInPlaylistCount} di ${album.total_tracks} brani sono nella playlist.</p>
            ` : ''}
          </div>
        </header>

        <main>
          <h3>Tracklist</h3>
          <ol class="tracklist">
            ${album.tracks.items.map(renderTrack).join('')}
          </ol>
        </main>

        <footer class="text-center mt-4">
          <!-- Semplificato con un link invece che con un pulsante JS -->
          <a href="javascript:history.back()" class="btn btn-secondary">&larr; Torna Indietro</a>
        </footer>
        
      </div>
    </body>
    </html>
  `;
}; // <-- Questa parentesi graffa chiude la funzione `renderAlbumDetailPage`

module.exports = {
  renderAlbumDetailPage,
};
