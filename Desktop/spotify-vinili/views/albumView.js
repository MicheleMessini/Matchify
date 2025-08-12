// Importa funzioni di utilità essenziali.
// escapeHtml -> Per la sicurezza, previene attacchi XSS.
// formatDuration -> Per formattare la durata da millisecondi a un formato leggibile.
const { escapeHtml, formatDuration } = require('../utils/helpers');

/**
 * Genera l'HTML completo per la pagina di dettaglio di un album.
 * @param {object} viewData - Oggetto contenente tutti i dati per la vista (album, tracce, ecc.).
 * @returns {string} - L'intera pagina HTML come stringa pronta per essere inviata al client.
 */
const renderAlbumDetailPage = (viewData) => {
  const { album, tracksDetails, playlistId, playlistTrackUris } = viewData;

  // --- 1. Calcolo dei dati derivati (tutti necessari per la UI) ---

  // Calcola la durata totale dell'album sommando la durata di ogni traccia.
  const totalDurationMs = album.tracks.items.reduce((total, track) => total + (track.duration_ms || 0), 0);
  const totalDurationText = formatDuration(totalDurationMs);
  
  // Conta quante tracce dell'album sono già nella playlist dell'utente.
  const tracksInPlaylistCount = album.tracks.items.filter(track => playlistTrackUris.has(track.uri)).length;
  
  // Calcola la percentuale di completamento.
  const completionPercentage = album.total_tracks > 0
    ? Math.round((tracksInPlaylistCount / album.total_tracks) * 100)
    : 0;

  // --- 2. Definizione della funzione helper per renderizzare ogni traccia ---
  // È definita qui dentro perché serve solo a questa funzione principale.
  const renderTrack = (track) => {
    const trackDetail = tracksDetails.tracks.find(t => t.id === track.id);
    const isInPlaylist = playlistTrackUris.has(track.uri);
    const duration = formatDuration(track.duration_ms || 0);
    const popularity = trackDetail?.popularity || 0; // Uso di optional chaining per più pulizia

    return `
      <li class="track-item ${isInPlaylist ? 'in-playlist' : ''}">
        <div class="track-info">
          <span class="track-number">${track.track_number}</span>
          <span class="track-name">${escapeHtml(track.name)}</span>
          <span class="track-artists d-none d-md-inline"> - ${escapeHtml(track.artists.map(a => a.name).join(', '))}</span>
        </div>
        <div class="track-details">
          <span class="track-popularity" title="Popolarità: ${popularity}/100">
            <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0-1.5A5.5 5.5 0 1 0 8 2.5a5.5 5.5 0 0 0 0 11"/></svg>
            ${popularity}
          </span>
          <span class="track-duration">${duration}</span>
          <span class="track-status" title="${isInPlaylist ? 'Nella playlist' : 'Non nella playlist'}">${isInPlaylist ? '✔️' : '❌'}</span>
        </div>
      </li>
    `;
  };

  // --- 3. Costruzione della pagina HTML completa ---

  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Album: ${escapeHtml(album.name)}</title>
      <link rel="stylesheet" href="/styles.css">
      
      <!-- Intestazione di sicurezza: essenziale per proteggere da attacchi. -->
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self'; img-src 'self' data: https:;">
    </head>
    <body>
      <div class="container">
        
        <header class="album-header">
          <img src="${escapeHtml(album.images?.[0]?.url || '/placeholder.png')}" 
               alt="Copertina di ${escapeHtml(album.name)}" 
               class="album-cover"
               onerror="this.src='/placeholder.png'">
          <div class="album-info">
            <h1>${escapeHtml(album.name)}</h1>
            <h2>by ${album.artists.map(a => escapeHtml(a.name)).join(', ')}</h2>
            <p>
              ${new Date(album.release_date).getFullYear()} &bull; 
              ${album.total_tracks} tracce &bull; 
              ${totalDurationText}
            </p>
            ${playlistId ? `
              <div class="playlist-completion-badge" title="${tracksInPlaylistCount} di ${album.total_tracks} tracce sono nella tua playlist">
                <span class="badge bg-success">Completamento: ${completionPercentage}%</span>
              </div>
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
          <button onclick="history.back()" class="btn btn-secondary">&larr; Torna Indietro</button>
        </footer>
        
      </div>
    </body>
    </html>
  `;
};

// Esporta solo la funzione principale, nascondendo i dettagli interni.
module.exports = {
  renderAlbumDetailPage,
};
