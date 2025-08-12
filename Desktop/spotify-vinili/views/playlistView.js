// CORREZIONE APPLICATA QUI: il percorso ora punta alla cartella /utils
const { escapeHtml, renderPagination, formatDuration, ALBUMS_PER_PAGE, MAX_ARTISTS_DISPLAYED } = require('../utils/helpers');

// =================================================================
// --- Componenti di UI Riutilizzabili (Allineati a styles.css) ---
// =================================================================

/**
 * Genera l'HTML per una singola "card" di playlist.
 * Usa il componente .card personalizzato da styles.css.
 */
const renderPlaylistCard = (playlist) => {
  const trackCount = playlist.tracks?.total || 0;
  
  // La griglia sarà gestita dal contenitore .grid, non più dalle classi col-*
  return `
    <div class="card" data-playlist-id="${escapeHtml(playlist.id)}">
      <a href="/playlist/${escapeHtml(playlist.id)}" class="card-link" style="text-decoration: none; color: inherit;">
        <div class="card-img-wrapper">
          <img src="${escapeHtml(playlist.images?.[0]?.url || '/placeholder.png')}" 
               alt="Copertina di ${escapeHtml(playlist.name)}" 
               class="card-img"
               onerror="this.src='/placeholder.png'">
        </div>
        <div class="card-content">
          <h4 class="card-title">${escapeHtml(playlist.name)}</h4>
          <p class="card-text">
            Di: ${escapeHtml(playlist.owner?.display_name || 'Sconosciuto')} &bull; ${trackCount} tracce
            <br>
            <span class="duration-text duration-loading text-muted">Caricamento durata...</span>
          </p>
        </div>
      </a>
    </div>
  `;
};

/**
 * Genera l'HTML per una singola card di un artista.
 * Usa il componente .card personalizzato.
 */
const renderArtistCard = (artist) => `
  <div class="card">
    <div class="card-img-wrapper">
      <img src="${escapeHtml(artist.image)}" 
           class="card-img" 
           alt="Foto di ${escapeHtml(artist.name)}"
           onerror="this.src='/placeholder.png'">
    </div>
    <div class="card-content">
      <h4 class="card-title">${escapeHtml(artist.name)}</h4>
      <p class="card-text">
        <span class="badge badge-info">${artist.trackCount} brani in questa playlist</span>
      </p>
    </div>
  </div>
`;

/**
 * Genera l'HTML per una singola card di un album.
 * Usa il componente .card personalizzato con una progress bar integrata.
 */
const renderAlbumCard = (album, playlistId) => `
  <div class="card">
    <a href="/album/${escapeHtml(album.id)}?playlistId=${escapeHtml(playlistId)}" class="card-link" style="text-decoration: none; color: inherit;">
      <div class="card-img-wrapper">
        <img src="${escapeHtml(album.image)}" 
             class="card-img" 
             alt="Copertina di ${escapeHtml(album.name)}"
             onerror="this.src='/placeholder.png'">
      </div>
      <div class="card-content">
        <h4 class="card-title">${escapeHtml(album.name)}</h4>
        <p class="card-text text-muted">${escapeHtml(album.artist)}</p>

        <!-- MIGLIORAMENTO: Progress bar integrata nello stile del tema -->
        <div class="album-progress mt-2" title="${album.tracksPresent} di ${album.totalTracks} tracce presenti">
          <div class="progress-bar-background">
            <div class="progress-bar-foreground" 
                 style="width: ${album.percentage}%; background-color: var(${album.percentage >= 50 ? '--spotify-green' : album.percentage >= 25 ? '--color-warning' : '--gray-500'});">
            </div>
          </div>
          <span class="progress-label">${album.tracksPresent}/${album.totalTracks}</span>
        </div>
      </div>
    </a>
  </div>

  <!-- Aggiungi questo stile nel tuo CSS per la progress bar personalizzata se non presente -->
  <style>
    .album-progress { display: flex; align-items: center; gap: var(--space-xs); }
    .progress-bar-background { flex-grow: 1; height: 8px; background: var(--gray-700); border-radius: var(--radius-full); overflow: hidden; }
    .progress-bar-foreground { height: 100%; border-radius: var(--radius-full); transition: width 0.5s ease; }
    .progress-label { font-size: var(--fs-xs); color: var(--gray-300); font-weight: var(--fw-medium); }
  </style>
`;


// =================================================================
// --- Funzioni Principali per la Renderizzazione delle Pagine ---
// =================================================================

/**
 * Genera l'HTML completo per la pagina principale che elenca tutte le playlist.
 */
const renderPlaylistsPage = (playlists, currentPage, totalPages) => {
  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Matchify - Le tue Playlist</title>
      <link rel="stylesheet" href="/styles.css">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;" />
    </head>
    <body>
      <div class="container">
        <header class="text-center">
          <h1>Le Tue Playlist</h1>
          <p class="text-muted">Seleziona una playlist per analizzarne il contenuto.</p>
        </header>
        
        <main>
          ${playlists.length === 0 ? `
            <div class="text-center" style="padding: var(--space-2xl) 0;">
              <p>Non sembra tu abbia playlist. Creane una su Spotify e torna qui!</p>
              <a href="/" class="btn btn-primary mt-2">Ricarica la pagina</a>
            </div>
          ` : `
            <!-- MIGLIORAMENTO: Uso del componente .grid per un layout moderno e responsivo -->
            <div class="grid mt-4">
              ${playlists.map(renderPlaylistCard).join('')}
            </div>
          `}
          
          <nav class="pagination-nav mt-4">
            ${renderPagination(currentPage, totalPages, '/?')}
          </nav>
        </main>
      </div>

      <!-- Script per caricare le durate delle playlist (nessuna modifica necessaria, è un ottimo pattern) -->
      <script>
        document.addEventListener('DOMContentLoaded', () => {
          document.querySelectorAll('[data-playlist-id]').forEach(card => {
            const playlistId = card.dataset.playlistId;
            const durationElement = card.querySelector('.duration-text');
    
            if (!playlistId || !durationElement) return;

            fetch('/api/duration/' + playlistId)
              .then(response => {
                if (!response.ok) throw new Error('API Response not OK');
                return response.json();
              })
              .then(data => {
                durationElement.textContent = data.durationText || 'Durata N/D';
                durationElement.classList.remove('duration-loading');
              })
              .catch(error => {
                console.warn('Could not fetch duration for ' + playlistId, error);
                durationElement.textContent = 'Durata N/D';
                durationElement.classList.remove('duration-loading');
                durationElement.style.color = 'var(--color-error)';
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
 */
const renderPlaylistDetailPage = (viewData) => {
  const { playlist, stats, view, page, contentData, totalPages } = viewData;

  const contentHtml = `
    <div class="view-toggle mb-4">
      <a href="/playlist/${escapeHtml(playlist.id)}?view=album" 
         class="btn ${view !== 'artist' ? 'btn-primary' : 'btn-secondary'}">
         Vista Album
      </a>
      <a href="/playlist/${escapeHtml(playlist.id)}?view=artist" 
         class="btn ${view === 'artist' ? 'btn-primary' : 'btn-secondary'}">
         Vista Artisti
      </a>
    </div>
    <div class="grid">
      ${view === 'artist' 
        ? contentData.map(renderArtistCard).join('')
        : contentData.map(album => renderAlbumCard(album, playlist.id)).join('')
      }
    </div>
    ${view === 'album' ? renderPagination(page, totalPages, `/playlist/${playlist.id}?view=album&`) : ''}
  `;

  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dettaglio: ${escapeHtml(playlist.name)}</title>
      <link rel="stylesheet" href="/styles.css">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' data:; img-src 'self' data: https:;" />
    </head>
    <body>
      <div class="container">
      
        <!-- MIGLIORAMENTO: Uso del componente .album-header per un'intestazione d'impatto -->
        <header class="album-header">
            <div class="album-cover-wrapper">
                <!-- Icona SVG che rappresenta una playlist, per coerenza visiva -->
                <svg class="album-cover" style="padding: 2rem;" fill="var(--spotify-green)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M18 19.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM18 6.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM6 19v-2h12v2H6Zm0-5.5V11h12v2.5H6ZM6 8V5.5h12V8H6Z"/></svg>
            </div>
            <div class="album-info">
                <h1>${escapeHtml(playlist.name)}</h1>
                <p class="text-muted" style="max-width: 65ch;">${escapeHtml(playlist.description || '')}</p>
                <div class="album-meta mt-3">
                  <span class="badge badge-success">Di: ${escapeHtml(playlist.owner?.display_name || 'Sconosciuto')}</span>
                  <span class="badge badge-info">${stats.totalTracks} brani &tilde; ${stats.durationText}</span>
                  <span class="badge badge-warning">${stats.uniqueArtistsCount} artisti unici</span>
                </div>
            </div>
        </header>

        <main class="mt-4">
          ${contentHtml}
        </main>
        
        <footer class="text-center mt-4">
          <a href="/" class="btn btn-secondary">&larr; Torna a tutte le playlist</a>
        </footer>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  renderPlaylistsPage,
  renderPlaylistDetailPage
};
