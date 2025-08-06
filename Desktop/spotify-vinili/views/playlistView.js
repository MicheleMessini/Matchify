// CORREZIONE APPLICATA QUI: il percorso ora punta alla cartella /utils
const { escapeHtml, renderPagination, formatDuration, ALBUMS_PER_PAGE, MAX_ARTISTS_DISPLAYED } = require('../utils/helpers');

// =================================================================
// --- Componenti di UI Riutilizzabili (Sub-Viste) ---
// =================================================================

/**
 * Genera l'HTML per una singola "card" di playlist nella pagina principale.
 * @param {object} playlist - L'oggetto playlist fornito dall'API di Spotify.
 * @returns {string} - La stringa HTML per la card.
 */
const renderPlaylistCard = (playlist) => {
  const trackCount = playlist.tracks?.total || 0;
  
  return `
    <div class="col-lg-4 col-md-6 mb-4">
      <div class="card h-100" data-playlist-id="${escapeHtml(playlist.id)}">
        <a href="/playlist/${escapeHtml(playlist.id)}" class="card-link">
          <img src="${escapeHtml(playlist.images?.[0]?.url || '/placeholder.png')}" 
               alt="Copertina di ${escapeHtml(playlist.name)}" 
               class="card-img-top"
               onerror="this.src='/placeholder.png'">
          <div class="card-body">
            <h5 class="card-title">${escapeHtml(playlist.name)}</h5>
            <p class="card-text">
              <small class="text-muted">
                Di: ${escapeHtml(playlist.owner?.display_name || 'Sconosciuto')} <br>
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

/**
 * Genera l'HTML per una singola card di un artista nella vista di dettaglio della playlist.
 * @param {object} artist - Oggetto artista preparato (con id, nome, immagine, trackCount).
 * @returns {string} - La stringa HTML per la card.
 */
const renderArtistCard = (artist) => `
  <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
    <div class="card h-100">
      <img src="${escapeHtml(artist.image)}" 
           class="card-img-top" 
           alt="Foto di ${escapeHtml(artist.name)}"
           onerror="this.src='/placeholder.png'">
      <div class="card-body">
        <h5 class="card-title">${escapeHtml(artist.name)}</h5>
        <p class="card-text">
          <span class="badge bg-primary">${artist.trackCount} brani</span>
        </p>
      </div>
    </div>
  </div>
`;

/**
 * Genera l'HTML per una singola card di un album nella vista di dettaglio della playlist.
 * @param {object} album - Oggetto album preparato.
 * @param {string} playlistId - L'ID della playlist per il link-back.
 * @returns {string} - La stringa HTML per la card.
 */
const renderAlbumCard = (album, playlistId) => `
  <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
    <div class="card h-100">
      <a href="/album/${escapeHtml(album.id)}?playlistId=${escapeHtml(playlistId)}" 
         class="card-link">
        <img src="${escapeHtml(album.image)}" 
             class="card-img-top" 
             alt="Copertina di ${escapeHtml(album.name)}"
             onerror="this.src='/placeholder.png'">
        <div class="card-body">
          <h5 class="card-title">${escapeHtml(album.name)}</h5>
          <p class="card-text">
            <small class="text-muted">${escapeHtml(album.artist)}</small>
          </p>
          <div class="progress" style="height: 20px;">
             <div class="progress-bar ${album.percentage >= 50 ? 'bg-success' : album.percentage >= 25 ? 'bg-warning' : 'bg-secondary'}"
                  role="progressbar" 
                  style="width: ${album.percentage}%;"
                  aria-valuenow="${album.percentage}"
                  aria-valuemin="0"
                  aria-valuemax="100">
                  ${album.tracksPresent}/${album.totalTracks}
             </div>
          </div>
        </div>
      </a>
    </div>
  </div>
`;

// =================================================================
// --- Funzioni Principali per la Renderizzazione delle Pagine ---
// =================================================================

/**
 * Genera l'HTML completo per la pagina principale che elenca tutte le playlist.
 * @param {Array<object>} playlists - L'array di playlist paginate.
 * @param {number} currentPage - Il numero della pagina corrente.
 * @param {number} totalPages - Il numero totale di pagine.
 * @returns {string} - L'intera pagina HTML come stringa.
 */
const renderPlaylistsPage = (playlists, currentPage, totalPages) => {
  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Le tue Playlist Spotify</title>
      <link rel="stylesheet" href="/styles.css">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;" />
    </head>
    <body>
      <div class="container">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h1>Le tue Playlist</h1>
          <!-- Aggiungi qui un eventuale link per il logout -->
        </div>
        
        ${playlists.length === 0 ? `
          <div class="text-center">
            <p>Non hai ancora nessuna playlist. Creane una su Spotify!</p>
            <a href="/start" class="btn btn-primary">Ricarica</a>
          </div>
        ` : `
          <div class="row">
            ${playlists.map(renderPlaylistCard).join('')}
          </div>
        `}
        
        ${renderPagination(currentPage, totalPages, '/?')}
      </div>

      <!-- Script per caricare le durate delle playlist in modo asincrono -->
      <script>
        document.addEventListener('DOMContentLoaded', () => {
          document.querySelectorAll('[data-playlist-id]').forEach(card => {
            const playlistId = card.dataset.playlistId;
            const durationElement = card.querySelector('.duration-text');
    
            fetch('/api/duration/' + playlistId)
              .then(response => response.ok ? response.json() : Promise.reject('API Response not OK'))
              .then(data => {
                if (data && data.durationText) {
                  durationElement.textContent = data.durationText;
                  durationElement.classList.remove('duration-loading');
                  durationElement.classList.add('duration-info');
                } else {
                  throw new Error('Invalid data format from API');
                }
              })
              .catch(error => {
                console.warn('Could not fetch duration for ' + playlistId, error);
                durationElement.textContent = 'Durata N/D';
                durationElement.classList.remove('duration-loading');
                durationElement.classList.add('duration-error');
              });
          });
        });
      </script>
    </body>
    </html>
  `;
};

/**
 * Genera l'HTML per la pagina di dettaglio di una playlist.
 * @param {object} viewData - Oggetto contenente tutti i dati preparati dal controller.
 * @returns {string} - L'intera pagina HTML come stringa.
 */
const renderPlaylistDetailPage = (viewData) => {
  const { playlist, stats, view, page, contentData, totalPages } = viewData;

  let contentHtml = 'Contenuto non disponibile.';
  if (view === 'artist') {
    contentHtml = `
      <h2 class="mb-4">Top ${MAX_ARTISTS_DISPLAYED} Artisti</h2>
      <div class="row">
        ${contentData.map(renderArtistCard).join('')}
      </div>
    `;
  } else { // 'album' view
    contentHtml = `
      <h2 class="mb-4">Album nella Playlist (${stats.totalAlbums})</h2>
      <div class="row">
        ${contentData.map(album => renderAlbumCard(album, playlist.id)).join('')}
      </div>
      ${renderPagination(page, totalPages, `/playlist/${playlist.id}?view=album&`)}
    `;
  }

  return `
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
        <div class="playlist-header mb-4">
          <h1>${escapeHtml(playlist.name)}</h1>
          <p class="lead">${escapeHtml(playlist.description || '')}</p>
          <p>
            Di <strong>${escapeHtml(playlist.owner?.display_name || 'Sconosciuto')}</strong><br>
            ${stats.totalTracks} brani, circa ${stats.durationText}
          </p>
          <p>
              <span class="badge bg-info me-2">${stats.uniqueAlbumsCount} album unici</span>
              <span class="badge bg-info">${stats.uniqueArtistsCount} artisti unici</span>
          </p>
        </div>
        
        <div class="view-toggle mb-4">
          <a href="/playlist/${escapeHtml(playlist.id)}?view=album" 
             class="btn ${view !== 'artist' ? 'btn-primary' : 'btn-outline-secondary'}">
             Vista Album
          </a>
          <a href="/playlist/${escapeHtml(playlist.id)}?view=artist" 
             class="btn ${view === 'artist' ? 'btn-primary' : 'btn-outline-secondary'}">
             Vista Artisti
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
};

module.exports = {
  renderPlaylistsPage,
  renderPlaylistDetailPage
};
