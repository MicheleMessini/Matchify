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

/**
 * Helper: Genera attributi data-* per lazy loading e analytics
 */
const generateDataAttributes = (type, id, extra = {}) => {
  const attrs = [`data-type="${type}"`, `data-id="${escapeHtml(id)}"`];
  Object.entries(extra).forEach(([key, value]) => {
    attrs.push(`data-${key}="${escapeHtml(String(value))}"`);
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
    class="${escapeHtml(className)}"
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
 * Helper: Genera l'HTML per la card di una playlist
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
 * Helper: Genera l'HTML per la card di un artista
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
 * Helper: Genera l'HTML per la card di un album
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
 * Helper: Genera grafico a torta SVG per i generi musicali
 */
const renderGenrePieChart = (genres) => {
  if (!genres || genres.length === 0) {
    return '<p class="empty-genres">Nessun genere disponibile</p>';
  }

  const topGenres = genres.slice(0, 10);
  const otherGenres = genres.slice(10);

  let displayGenres = [...topGenres];
  if (otherGenres.length > 0) {
    const otherCount = otherGenres.reduce((sum, g) => sum + g.count, 0);
    const otherPercentage = otherGenres.reduce((sum, g) => sum + g.percentage, 0);
    displayGenres.push({
      name: 'Altri generi',
      count: otherCount,
      percentage: otherPercentage,
      artists: []
    });
  }

  let currentAngle = 0;
  const radius = 100;
  const centerX = 120;
  const centerY = 120;

  const polarToCartesian = (centerX, centerY, radius, angle) => {
    const rad = (angle - 90) * Math.PI / 180;
    return {
      x: centerX + radius * Math.cos(rad),
      y: centerY + radius * Math.sin(rad)
    };
  };

  const generateSlicePath = (startAngle, endAngle) => {
    const start = polarToCartesian(centerX, centerY, radius, endAngle);
    const end = polarToCartesian(centerX, centerY, radius, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

    return `M ${centerX} ${centerY} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
  };

  const slices = displayGenres.map((genre, index) => {
    const angle = (genre.percentage / 100) * 360;
    const slice = {
      genre,
      startAngle: currentAngle,
      endAngle: currentAngle + angle,
      color: GENRE_COLORS[index % GENRE_COLORS.length]
    };
    currentAngle += angle;
    return slice;
  });

  const svgSlices = slices.map(slice => `
    <path
      d="${generateSlicePath(slice.startAngle, slice.endAngle)}"
      fill="${slice.color}"
      class="pie-slice"
      data-genre="${escapeHtml(slice.genre.name)}"
      data-percentage="${slice.genre.percentage}"
      data-count="${slice.genre.count}">
      <title>${escapeHtml(slice.genre.name)}: ${slice.genre.percentage}%</title>
    </path>
  `).join('');

  const legend = displayGenres.map((genre, index) => `
    <div class="legend-item" data-genre="${escapeHtml(genre.name)}">
      <span class="legend-color" style="background-color: ${GENRE_COLORS[index % GENRE_COLORS.length]}"></span>
      <span class="legend-label">${escapeHtml(genre.name)}</span>
      <span class="legend-value">${genre.percentage}%</span>
    </div>
  `).join('');

  return `
    <div class="genre-chart-container">
      <div class="pie-chart-wrapper">
        <svg viewBox="0 0 240 240" class="pie-chart">
          ${svgSlices}
          <circle cx="${centerX}" cy="${centerY}" r="50" fill="#1a1a1a" class="pie-hole"/>
        </svg>
        <div class="chart-center-text">
          <div class="center-number">${displayGenres.length}</div>
          <div class="center-label">Generi</div>
        </div>
      </div>
      <div class="genre-legend">
        ${legend}
      </div>
    </div>
  `;
};

/**
 * Helper: Genera lista dettagliata dei generi
 */
const renderGenreList = (genres) => {
  if (!genres || genres.length === 0) return '';

  return `
    <div class="genre-list">
      ${genres.map((genre, index) => `
        <div class="genre-item">
          <div class="genre-header">
            <span class="genre-rank">#${index + 1}</span>
            <h3 class="genre-name">${escapeHtml(genre.name)}</h3>
            <span class="genre-percentage">${genre.percentage}%</span>
          </div>
          <div class="genre-stats">
            <span class="genre-count">${genre.count} ${genre.count === 1 ? 'brano' : 'brani'}</span>
            ${genre.artists.length > 0 ? `
              <span class="genre-artists">
                Artisti: ${escapeHtml(genre.artists.slice(0, 3).join(', '))}${genre.artists.length > 3 ? '...' : ''}
              </span>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
};

/**
 * Helper: Genera filtri e ordinamento con 3 bottoni
 */
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

/**
 * Funzione principale: Genera l'HTML per la pagina di dettaglio di una playlist
 */
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
                ? `
                  ${renderGenrePieChart(contentData)}
                  ${renderGenreList(contentData)}
                `
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

module.exports = {
  renderPlaylistsPage,
  renderPlaylistDetailPage,
  CONFIG
};
