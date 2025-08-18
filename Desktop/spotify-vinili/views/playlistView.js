const { escapeHtml, renderPagination } = require('../utils/helpers');
const renderPlaylistCard = (playlist) => { /* ... */ };
const renderArtistCard = (artist) => { /* ... */ };
const renderAlbumCard = (album, playlistId) => { /* ... */ };
const renderPlaylistsPage = (playlists, currentPage, totalPages) => {
  return `
    <!DOCTYPE html><html lang="it"><head>
      <title>Matchify - Le tue Playlist</title>
      <link rel="stylesheet" href="/playlists.css">
    </head><body>
      <div class="container">
        <header class="text-center" style="margin-bottom: var(--space-xl);"><h1>Le Tue Playlist</h1></header>
        <main>
          ${playlists.length ? `<div class="playlist-grid">${playlists.map(renderPlaylistCard).join('')}</div>` : `<p class="text-center">Nessuna playlist trovata.</p>`}
          <nav class="pagination-nav">${renderPagination(currentPage, totalPages, '/?')}</nav>
        </main>
      </div>
    </body></html>
  `;
};
const renderPlaylistDetailPage = (viewData) => {
  return `
    <!DOCTYPE html><html lang="it"><head>
      <title>Dettaglio: ${escapeHtml(viewData.playlist.name)}</title>
      <link rel="stylesheet" href="/playlists.css">
    </head><body>
      <div class="container">
        <header class="text-center" style="margin-bottom: var(--space-xl);">
          <h1>${escapeHtml(viewData.playlist.name)}</h1>
          <p class="text-muted">${escapeHtml(viewData.playlist.description || `Di ${escapeHtml(viewData.playlist.owner?.display_name || 'Sconosciuto')}`)}</p>
        </header>
        <main>${contentHtml}</main>
        <footer class="text-center" style="margin-top: var(--space-xl);"><a href="/" class="btn btn-secondary">&larr; Torna alle playlist</a></footer>
      </div>
    </body></html>
  `;
};
module.exports = { renderPlaylistsPage, renderPlaylistDetailPage };
```*(Ho abbreviato `playlistView.js` ma il concetto chiave è cambiare il link CSS)*

#### `views/albumView.js` (AGGIORNATO)
```javascript
const { escapeHtml, formatDuration } = require('../utils/helpers');
const renderAlbumDetailPage = (viewData) => {
  // ... (tutta la tua logica JS qui) ...
  const renderTrack = (track) => { /* ... */ };
  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Album: ${escapeHtml(viewData.album.name)}</title>
      <link rel="stylesheet" href="/album.css">
    </head>
    <body>
      <div class="container">
        <header class="album-header">
          <img src="${escapeHtml(viewData.album.images?.[0]?.url || '/placeholder.png')}" alt="..." class="album-cover">
          <div>
            <h1>${escapeHtml(viewData.album.name)}</h1>
            <p class="text-muted">di ${viewData.album.artists.map(a => escapeHtml(a.name)).join(', ')}</p>
          </div>
        </header>
        <main>
          <h3>Tracklist</h3>
          <ol class="tracklist">${viewData.album.tracks.items.map(renderTrack).join('')}</ol>
        </main>
        <footer class="text-center"><a href="javascript:history.back()" class="btn btn-secondary">&larr; Indietro</a></footer>
      </div>
    </body>
    </html>
  `;
};
module.exports = { renderAlbumDetailPage };
