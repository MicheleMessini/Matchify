const { escapeHtml, renderPagination } = require('../utils/helpers');

/**
 * Helper: Genera l'HTML per la card di una playlist.
 */
const renderPlaylistCard = (playlist) => {
  const trackCount = playlist.tracks?.total || 0;
  
  return `
    <div class="card">
      <a href="/playlist/${escapeHtml(playlist.id)}">
        <div class="card-img-wrapper">
          <img src="${escapeHtml(playlist.images?.[0]?.url || '/placeholder.png')}" 
               alt="${escapeHtml(playlist.name)}" 
               class="card-img"
               onerror="this.src='/placeholder.png'">
        </div>
        <div class="card-content">
          <h4 class="card-title">${escapeHtml(playlist.name)}</h4>
          <p class="card-text text-muted">
            Di ${escapeHtml(playlist.owner?.display_name || 'Sconosciuto')}
            <br>
            ${trackCount} tracce
          </p>
        </div>
      </a>
    </div>
  `;
};

/**
 * Helper: Genera l'HTML per la card di un artista.
 */
const renderArtistCard = (artist) => `
  <div class="card">
    <div class="card-img-wrapper">
      <img src="${escapeHtml(artist.image)}" alt="${escapeHtml(artist.name)}" class="card-img" onerror="this.src='/placeholder.png'">
    </div>
    <div class="card-content">
      <h4 class="card-title">${escapeHtml(artist.name)}</h4>
      <p class="card-text text-muted">${artist.trackCount} brani in questa playlist</p>
    </div>
  </div>
`;

/**
 * Helper: Genera l'HTML per la card di un album.
 */
const renderAlbumCard = (album, playlistId) => `
  <div class="card">
    <a href="/album/${escapeHtml(album.id)}?playlistId=${escapeHtml(playlistId)}">
      <div class="card-img-wrapper">
        <img src="${escapeHtml(album.image)}" alt="${escapeHtml(album.name)}" class="card-img" onerror="this.src='/placeholder.png'">
      </div>
      <div class="card-content">
        <h4 class="card-title">${escapeHtml(album.name)}</h4>
        <p class="card-text text-muted">${escapeHtml(album.artist)}</p>
        <p class="card-text text-primary">${album.tracksPresent} / ${album.totalTracks} brani</p>
      </div>
    </a>
  </div>
`;

/**
 * Funzione principale: Genera l'HTML per la pagina di elenco delle playlist.
 */
const renderPlaylistsPage = (playlists, currentPage, totalPages) => {
  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Matchify - Le tue Playlist</title>
      <link rel="stylesheet" href="/playlists.css">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self'; img-src 'self' data: https:;">
    </head>
    <body>
      <div class="container">
        <header class="text-center" style="margin-bottom: var(--space-xl);">
          <h1>Le Tue Playlist</h1>
        </header>
        <main>
          ${playlists.length > 0
            ? `<div class="playlist-grid">${playlists.map(renderPlaylistCard).join('')}</div>`
            : `<p class="text-center">Nessuna playlist trovata.</p>`
          }
          <nav class="pagination-nav">
            ${renderPagination(currentPage, totalPages, '/?')}
          </nav>
        </main>
      </div>
    </body>
    </html>
  `;
};

/**
 * Funzione principale: Genera l'HTML per la pagina di dettaglio di una playlist.
 */
const renderPlaylistDetailPage = (viewData) => {
  const { playlist, stats, view, page, contentData, totalPages } = viewData;

  const contentHtml = `
    <div class="view-toggle">
      <!-- CORREZIONE: Aggiunti i due punti ':' mancanti nell'operatore ternario -->
      <a href="/playlist/${playlist.id}?view=album" class="btn ${view !== 'artist' ? 'btn-primary' : 'btn-secondary'}">Vista Album</a>
      <a href="/playlist/${playlist.id}?view=artist" class="btn ${view === 'artist' ? 'btn-primary' : 'btn-secondary'}">Vista Artisti</a>
    </div>
    <div class="grid">
      ${view === 'artist' 
        ? contentData.map(renderArtistCard).join('')
        : contentData.map(album => renderAlbumCard(album, playlist.id)).join('')
      }
    </div>
    <nav class="pagination-nav">
      ${view === 'album' ? renderPagination(page, totalPages, `/playlist/${playlist.id}?view=album&`) : ''}
    </nav>
  `;

  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dettaglio: ${escapeHtml(playlist.name)}</title>
      <link rel="stylesheet" href="/playlists.css">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self'; img-src 'self' data: https:;">
    </head>
    <body>
      <div class="container">
        <header class="text-center" style="margin-bottom: var(--space-xl);">
            <h1>${escapeHtml(playlist.name)}</h1>
            <p class="text-muted">${escapeHtml(playlist.description || `Di ${escapeHtml(playlist.owner?.display_name || 'Sconosciuto')}`)}</p>
            <p class="text-primary">${stats.totalTracks} brani &bull; ${stats.durationText} &bull; ${stats.uniqueArtistsCount} artisti unici</p>
        </header>
        <main>${contentHtml}</main>
        <footer class="text-center" style="margin-top: var(--space-xl);">
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
