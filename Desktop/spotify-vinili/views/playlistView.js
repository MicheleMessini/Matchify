const { escapeHtml, renderPagination } = require('../utils/helpers');

/**
 * Configurazione e costanti
 */
const CONFIG = {
  PLACEHOLDER_IMAGE: '/placeholder.png',
  DEFAULT_OWNER: 'Sconosciuto',
  ITEMS_PER_PAGE: 20,
  PLAYLISTS_PER_PAGE: 20,
  ALBUMS_PER_PAGE: 20,
  MAX_ARTISTS_DISPLAYED: 50,
  VIEWS: {
    ALBUM: 'album',
    ARTIST: 'artist',
    GENRE: 'genre'
  }
};

// Palette di colori vivaci per il grafico a torta
const GENRE_COLORS = [
  '#1DB954', '#FF6B6B', '#4ECDC4', '#FFD93D', '#A8E6CF',
  '#FF8C94', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3',
  '#6C5CE7', '#FD79A8', '#FDCB6E', '#00B894', '#D63031',
  '#0984E3', '#E17055', '#74B9FF', '#A29BFE', '#FD79A8'
];

/* ============================================================
   HELPER DI BASE
   ============================================================ */

const generateDataAttributes = (type, id, extra = {}) => {
  const attrs = [`data-type="${type}"`, `data-id="${escapeHtml(id)}"`];
  Object.entries(extra).forEach(([key, value]) => {
    attrs.push(`data-${key}="${escapeHtml(String(value))}"`);
  });
  return attrs.join(' ');
};

const generateMetaTags = (title, description) => `
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta name="description" content="${escapeHtml(description)}">
`;

const renderImage = (src, alt, className = 'card-img') => `
  <img 
    src="${escapeHtml(src || CONFIG.PLACEHOLDER_IMAGE)}" 
    alt="${escapeHtml(alt)}" 
    class="${escapeHtml(className)}"
    loading="lazy"
    onerror="this.src='${CONFIG.PLACEHOLDER_IMAGE}'; this.onerror=null;"
  >
`;

const formatTrackCount = (count) => {
  if (count === 0) return 'Nessuna traccia';
  if (count === 1) return '1 traccia';
  return `${count} tracce`;
};

/* ============================================================
   CARD
   ============================================================ */

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

/* ============================================================
   GRAFICO GENERI
   ============================================================ */

const renderGenrePieChart = (genres) => {
  if (!genres || genres.length === 0) return '<p class="empty-genres">Nessun genere disponibile</p>';

  const PASTEL_COLORS = [
    '#D0F0C0', '#FFD1DC', '#FFB6C1', '#FFDAC1', '#E2F0CB',
    '#B5EAD7', '#C7CEEA', '#F8D8E4', '#D4A5A5', '#A8DADC',
    '#F1C0E8', '#CFBAE1', '#A3C4D9', '#88D8B0', '#FFC4D6',
    '#FAE3D9', '#BBDED6', '#8AC6D1', '#B8E0D2', '#D6EADF'
  ];

  let currentAngle = 0;
  const radius = 90;
  const centerX = 100;
  const centerY = 100;

  const polarToCartesian = (cx, cy, r, angle) => {
    const rad = (angle - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const generateSlicePath = (start, end) => {
    const s = polarToCartesian(centerX, centerY, radius, end);
    const e = polarToCartesian(centerX, centerY, radius, start);
    const large = end - start <= 180 ? 0 : 1;
    return `M ${centerX} ${centerY} L ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 0 ${e.x} ${e.y} Z`;
  };

  const slices = genres.map((genre, i) => {
    const angle = (genre.percentage / 100) * 360;
    const path = generateSlicePath(currentAngle, currentAngle + angle);
    currentAngle += angle;
    return `<path d="${path}" fill="${PASTEL_COLORS[i % PASTEL_COLORS.length]}" class="pie-slice"/>`;
  }).join('');

  const legend = genres.map((genre, i) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${PASTEL_COLORS[i % PASTEL_COLORS.length]}"></span>
      <span class="legend-name">${escapeHtml(genre.name)}</span>
      <span class="legend-percent">${genre.percentage}%</span>
    </div>
  `).join('');

  return `
    <div class="genre-chart-wrapper">
      <svg viewBox="0 0 200 200" class="pie-chart">${slices}</svg>
      <div class="genre-legend clean">${legend}</div>
    </div>
  `;
};

/* ============================================================
   ALTRI HELPER
   ============================================================ */

const renderFilters = (currentView, playlistId) => `
  <div class="filters-container">
    <div class="view-toggle" role="tablist">
      <a href="/playlist/${escapeHtml(playlistId)}?view=album" 
         class="btn ${currentView === CONFIG.VIEWS.ALBUM ? 'btn-primary active' : 'btn-secondary'}"
         role="tab"
         aria-selected="${currentView === CONFIG.VIEWS.ALBUM}"
         aria-label="Mostra vista album">
        📀 Vista Album
      </a>
      <a href="/playlist/${escapeHtml(playlistId)}?view=artist" 
         class="btn ${currentView === CONFIG.VIEWS.ARTIST ? 'btn-primary active' : 'btn-secondary'}"
         role="tab"
         aria-selected="${currentView === CONFIG.VIEWS.ARTIST}"
         aria-label="Mostra vista artisti">
        🎤 Vista Artisti
      </a>
      <a href="/playlist/${escapeHtml(playlistId)}?view=genre" 
         class="btn ${currentView === CONFIG.VIEWS.GENRE ? 'btn-primary active' : 'btn-secondary'}"
         role="tab"
         aria-selected="${currentView === CONFIG.VIEWS.GENRE}"
         aria-label="Mostra vista generi">
        🎵 Vista Generi
      </a>
    </div>
  </div>
`;

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
    },
    genre: {
      title: 'Nessun genere trovato',
      description: 'Non sono disponibili informazioni sui generi per questa playlist.',
      action: 'I generi vengono recuperati dagli artisti delle tracce.'
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

/* ============================================================
   PAGINE PRINCIPALI
   ============================================================ */

const renderPlaylistsPage = (playlists, currentPage, totalPages) => {
  const hasPlaylists = playlists.length > 0;
  const totalPlaylists = playlists.length + (currentPage - 1) * CONFIG.PLAYLISTS_PER_PAGE;

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

const renderPlaylistDetailPage = (viewData) => {
  const { playlist, stats, view, page, contentData, totalPages } = viewData;
  const hasContent = contentData && contentData.length > 0;

  const metaTags = generateMetaTags(
    `${playlist.name} - Matchify`,
    `${stats.totalTracks} brani • ${stats.durationText} • ${stats.uniqueArtistsCount} artisti • ${stats.uniqueGenres || 0} generi`
  );

  const content = `
    <div class="container">
      <main class="main-content">
        ${renderFilters(view, playlist.id)}

        ${view === CONFIG.VIEWS.GENRE
          ? `
            <section class="genre-section" aria-label="Analisi generi musicali">
              ${hasContent
                ? renderGenrePieChart(contentData)
                : renderEmptyState('genre')
              }
            </section>
          `
          : hasContent
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

/* ============================================================
   ESPORTAZIONE
   ============================================================ */

module.exports = {
  renderPlaylistsPage,
  renderPlaylistDetailPage,
  CONFIG
};
