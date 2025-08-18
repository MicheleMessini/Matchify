const { escapeHtml, renderPagination } = require('../utils/helpers');

/**
 * Configurazione e costanti
 */
const CONFIG = {
  PLACEHOLDER_IMAGE: '/placeholder.png',
  DEFAULT_OWNER: 'Sconosciuto',
  ITEMS_PER_PAGE: 20, // Assumendo un valore di default
  VIEWS: {
    ALBUM: 'album',
    ARTIST: 'artist'
  }
};

/**
 * Helper: Genera attributi data-* per lazy loading e analytics
 */
const generateDataAttributes = (type, id, extra = {}) => {
  const attrs = [`data-type="${type}"`, `data-id="${id}"`];
  Object.entries(extra).forEach(([key, value]) => {
    attrs.push(`data-${key}="${escapeHtml(value)}"`);
  });
  return attrs.join(' ');
};

/**
 * Helper: Genera meta tag SEO
 */
const generateMetaTags = (title, description) => `
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta name="description" content="${escapeHtml(description)}">
`;

/**
 * Helper: Genera l'HTML per l'immagine con lazy loading
 */
const renderImage = (src, alt, className = 'card-img') => `
  <img 
    src="${escapeHtml(src || CONFIG.PLACEHOLDER_IMAGE)}" 
    alt="${escapeHtml(alt)}" 
    class="${className}"
    loading="lazy"
    onerror="this.src='${CONFIG.PLACEHOLDER_IMAGE}'; this.onerror=null;"
  >
`;

/**
 * Helper: Formatta il numero di tracce con plurale corretto
 */
const formatTrackCount = (count) => {
  if (count === 0) return 'Nessuna traccia';
  if (count === 1) return '1 traccia';
  return `${count} tracce`;
};

/**
 * Helper: Genera badge per statistiche
 */
const renderStatBadge = (label, value, icon = '') => `
  <span class="stat-badge">
    ${icon ? `<span class="stat-icon">${icon}</span>` : ''}
    <span class="stat-label">${escapeHtml(label)}:</span>
    <span class="stat-value">${escapeHtml(value)}</span>
  </span>
`;

/**
 * Helper: Genera l'HTML per la card di una playlist con miglioramenti
 */
const renderPlaylistCard = (playlist) => {
  const trackCount = playlist.tracks?.total || 0;
  const imageUrl = playlist.images?.[0]?.url || CONFIG.PLACEHOLDER_IMAGE;
  const ownerName = playlist.owner?.display_name || CONFIG.DEFAULT_OWNER;
  
  return `
    <article class="card playlist-card" ${generateDataAttributes('playlist', playlist.id, { tracks: trackCount })}>
      <a href="/playlist/${escapeHtml(playlist.id)}" class="card-link" aria-label="Vai a ${escapeHtml(playlist.name)}">
        <div class="card-img-wrapper">
          ${renderImage(imageUrl, playlist.name)}
          ${trackCount > 0 ? `<span class="card-badge">${trackCount}</span>` : ''}
        </div>
        <div class="card-content">
          <h3 class="card-title">${escapeHtml(playlist.name)}</h3>
          <div class="card-meta">
            <p class="card-owner">Di ${escapeHtml(ownerName)}</p>
            <p class="card-stats">${formatTrackCount(trackCount)}</p>
          </div>
        </div>
      </a>
    </article>
  `;
};

/**
 * Helper: Genera l'HTML per la card di un artista con miglioramenti
 */
const renderArtistCard = (artist) => `
  <article class="card artist-card" ${generateDataAttributes('artist', artist.id || artist.name)}>
    <div class="card-img-wrapper">
      ${renderImage(artist.image, artist.name)}
      <div class="card-overlay">
        <span class="play-icon">▶</span>
      </div>
    </div>
    <div class="card-content">
      <h3 class="card-title">${escapeHtml(artist.name)}</h3>
      <p class="card-stats">
        <span class="track-count">${artist.trackCount} ${artist.trackCount === 1 ? 'brano' : 'brani'}</span>
        in questa playlist
      </p>
    </div>
  </article>
`;

/**
 * Helper: Genera l'HTML per la card di un album con progress bar
 */
const renderAlbumCard = (album, playlistId) => {
  const completionPercentage = Math.round((album.tracksPresent / album.totalTracks) * 100);
  const isComplete = album.tracksPresent === album.totalTracks;
  
  return `
    <article class="card album-card ${isComplete ? 'album-complete' : ''}" ${generateDataAttributes('album', album.id, { completion: completionPercentage })}>
      <a href="/album/${escapeHtml(album.id)}?playlistId=${escapeHtml(playlistId)}" class="card-link" aria-label="Vai all'album ${escapeHtml(album.name)}">
        <div class="card-img-wrapper">
          ${renderImage(album.image, album.name)}
          ${isComplete ? '<span class="complete-badge">✓</span>' : ''}
        </div>
        <div class="card-content">
          <h3 class="card-title">${escapeHtml(album.name)}</h3>
          <p class="card-artist">${escapeHtml(album.artist)}</p>
          <div class="track-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${completionPercentage}%"></div>
            </div>
            <p class="progress-text">
              <span class="tracks-present">${album.tracksPresent}</span> / 
              <span class="tracks-total">${album.totalTracks}</span> brani
              <span class="percentage">(${completionPercentage}%)</span>
            </p>
          </div>
        </div>
      </a>
    </article>
  `;
};

/**
 * Helper: Genera navigation breadcrumb
 */
const renderBreadcrumb = (items) => {
  const breadcrumbItems = items.map((item, index) => {
    const isLast = index === items.length - 1;
    return `
      <li class="breadcrumb-item ${isLast ? 'active' : ''}">
        ${isLast 
          ? `<span>${escapeHtml(item.label)}</span>`
          : `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`
        }
      </li>
    `;
  }).join('');
  
  return `
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        ${breadcrumbItems}
      </ol>
    </nav>
  `;
};

/**
 * Helper: Genera filtri e ordinamento
 */
const renderFilters = (currentView, playlistId) => `
  <div class="filters-container">
    <div class="view-toggle" role="tablist">
      <a href="/playlist/${playlistId}?view=album" 
         class="btn ${currentView !== CONFIG.VIEWS.ARTIST ? 'btn-primary active' : 'btn-secondary'}"
         role="tab"
         aria-selected="${currentView !== CONFIG.VIEWS.ARTIST}"
         aria-label="Mostra vista album">
        <span class="icon">📀</span> Vista Album
      </a>
      <a href="/playlist/${playlistId}?view=artist" 
         class="btn ${currentView === CONFIG.VIEWS.ARTIST ? 'btn-primary active' : 'btn-secondary'}"
         role="tab"
         aria-selected="${currentView === CONFIG.VIEWS.ARTIST}"
         aria-label="Mostra vista artisti">
        <span class="icon">👤</span> Vista Artisti
      </a>
    </div>
  </div>
`;

/**
 * Helper: Genera messaggio vuoto personalizzato
 */
const renderEmptyState = (type = 'playlist') => {
  const messages = {
    playlist: {
      title: 'Nessuna playlist trovata',
      description: 'Non hai ancora playlist salvate su Spotify.',
      action: 'Crea una nuova playlist su Spotify per iniziare!'
    },
    album: {
      title: 'Nessun album trovato',
      description: 'Questa playlist non contiene album.',
      action: 'Aggiungi brani alla playlist per vedere gli album.'
    },
    artist: {
      title: 'Nessun artista trovato',
      description: 'Questa playlist non contiene artisti.',
      action: 'Aggiungi brani alla playlist per vedere gli artisti.'
    }
  };
  
  const msg = messages[type] || messages.playlist;
  
  return `
    <div class="empty-state">
      <div class="empty-state-icon">📭</div>
      <h2 class="empty-state-title">${msg.title}</h2>
      <p class="empty-state-description">${msg.description}</p>
      <p class="empty-state-action">${msg.action}</p>
    </div>
  `;
};

/**
 * Helper: Genera layout HTML base
 */
const generateBaseLayout = (title, content, additionalHead = '') => `
  <!DOCTYPE html>
  <html lang="it">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/playlists.css">
    <link rel="preconnect" href="https://i.scdn.co">
    <link rel="dns-prefetch" href="https://i.scdn.co">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; script-src 'self';">
    ${additionalHead}
  </head>
  <body>
    <div class="app-container">
      ${content}
    </div>
    <script defer src="/app.js"></script>
  </body>
  </html>
`;

/**
 * Funzione principale: Genera l'HTML per la pagina di elenco delle playlist
 */
const renderPlaylistsPage = (playlists, currentPage, totalPages) => {
  const hasPlaylists = playlists.length > 0;
  const totalPlaylists = playlists.length + (currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
  
  const metaTags = generateMetaTags(
    'Matchify - Le tue Playlist',
    `Esplora le tue ${totalPlaylists} playlist Spotify con analisi dettagliate di album e artisti`
  );
  
  const content = `
    <div class="container">
      <header class="page-header">
        <div class="header-content">
          <h1 class="page-title">
            <span class="logo">🎵</span> Le Tue Playlist
          </h1>
          ${hasPlaylists ? `
          ` : ''}
        </div>
      </header>
      
      <main class="main-content">
        ${hasPlaylists
          ? `
            <section class="playlist-section" aria-label="Lista playlist">
              <div class="playlist-grid">
                ${playlists.map(renderPlaylistCard).join('')}
              </div>
            </section>
            
            ${totalPages > 1 ? `
              <nav class="pagination-nav" aria-label="Navigazione pagine">
                ${renderPagination(currentPage, totalPages, '/?')}
              </nav>
            ` : ''}
          `
          : renderEmptyState('playlist')
        }
      </main>

    </div>
  `;
  
  return generateBaseLayout('Matchify - Le tue Playlist', content, metaTags);
};

/**
 * Funzione principale: Genera l'HTML per la pagina di dettaglio di una playlist
 */
const renderPlaylistDetailPage = (viewData) => {
  const { playlist, stats, view, page, contentData, totalPages } = viewData;
  const hasContent = contentData && contentData.length > 0;
  
  // Calcola statistiche aggiuntive
  const avgTracksPerAlbum = view === CONFIG.VIEWS.ALBUM && contentData.length > 0
    ? Math.round(stats.totalTracks / contentData.length)
    : 0;
  
  const metaTags = generateMetaTags(
    `${playlist.name} - Matchify`,
    `${stats.totalTracks} brani • ${stats.durationText} • ${stats.uniqueArtistsCount} artisti • Analizza la tua playlist Spotify`
  );
  
  const breadcrumb = renderBreadcrumb([
    { label: 'Playlist', href: '/' },
    { label: playlist.name }
  ]);
  
  const content = `
    <div class="container">
      ${breadcrumb}
      
      <main class="main-content">
        ${renderFilters(view, playlist.id)}
        
        ${hasContent
          ? `
            <section class="content-section" aria-label="${view === CONFIG.VIEWS.ARTIST ? 'Lista artisti' : 'Lista album'}">
              <div class="grid ${view}-grid">
                ${view === CONFIG.VIEWS.ARTIST 
                  ? contentData.map(renderArtistCard).join('')
                  : contentData.map(album => renderAlbumCard(album, playlist.id)).join('')
                }
              </div>
            </section>
            
            ${view === CONFIG.VIEWS.ALBUM && totalPages > 1 ? `
              <nav class="pagination-nav" aria-label="Navigazione pagine">
                ${renderPagination(page, totalPages, `/playlist/${playlist.id}?view=album&`)}
              </nav>
            ` : ''}
          `
          : renderEmptyState(view)
        }
      </main>
      
      <footer class="page-footer">
        <div class="footer-actions">
          <a href="/" class="btn btn-secondary btn-back">
            <span class="btn-icon">←</span> Torna alle playlist
          </a>
        </div>
      </footer>
    </div>
  `;
  
  return generateBaseLayout(`${playlist.name} - Matchify`, content, metaTags);
};

module.exports = {
  renderPlaylistsPage,
  renderPlaylistDetailPage,
  // Esporta anche gli helper per test unitari
  renderPlaylistCard,
  renderArtistCard,
  renderAlbumCard,
  renderBreadcrumb,
  renderFilters,
  renderEmptyState,
  formatTrackCount,
  CONFIG
};
