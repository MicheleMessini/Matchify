const { makeSpotifyRequest } = require('../services/spotifyService');
const appCache = require('../utils/cache');
const {
    validatePageNumber,
    validatePlaylistId,
    handleError,
    delay,
    PLAYLISTS_PER_PAGE,
    ALBUMS_PER_PAGE,
    MAX_ARTISTS_DISPLAYED,
    formatDuration
} = require('../utils/helpers');
const { renderPlaylistsPage, renderPlaylistDetailPage } = require('../views/playlistView');

// --- Funzioni Helper Interne al Controller ---

const PLAYLIST_RATE_LIMIT_DELAY = 100;

/**
 * Recupera *tutte* le playlist di un utente, con LOG DI DEBUG.
 */
const fetchAllUserPlaylists = async (accessToken) => {
  let playlists = [];
  let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=50';

  console.log('--- Inizio fetchAllUserPlaylists ---');
  let pageCount = 1;

  while (nextUrl) {
    console.log(`Chiamata API per pagina ${pageCount}...`);
    const data = await makeSpotifyRequest(nextUrl, accessToken);
    
    // DEBUG: Stampa un riassunto di cosa abbiamo ricevuto
    console.log(`Pagina ${pageCount}: Ricevuti ${data?.items?.length || 0} items. ` +
                `Total dalla risposta API: ${data?.total}. Next URL: ${data?.next || 'Nessuno'}`);

    if (data && Array.isArray(data.items)) {
      const validPlaylists = data.items.filter(p => p && p.id);
      playlists.push(...validPlaylists);
    } else {
      console.warn('⚠️ La risposta API non contiene un array `items` valido. Interruzione del ciclo.');
      break;
    }
    
    nextUrl = data.next;
    pageCount++;
  }

  console.log(`--- Fine fetchAllUserPlaylists. Playlist totali accumulate: ${playlists.length} ---`);
  return playlists;
};


/**
 * Recupera *tutte* le tracce di una singola playlist.
 */
const fetchAllPlaylistTracks = async (playlistId, accessToken) => {
  let tracks = [];
  let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=items(track(duration_ms,name,id,artists,album(id,name,images,total_tracks,artists),uri)),next,total`;

  while (nextUrl) {
    const tracksData = await makeSpotifyRequest(nextUrl, accessToken);
    if (tracksData?.items) {
      tracks.push(...tracksData.items.filter(item => item && item.track));
    }
    nextUrl = tracksData.next;
    if (nextUrl) await delay(PLAYLIST_RATE_LIMIT_DELAY);
  }
  return tracks;
};

// --- Funzioni Esportate ---

/**
 * Calcola la durata di una playlist.
 */
const calculatePlaylistDuration = async (playlist, accessToken) => {
  const cacheKey = `duration:${playlist.id}`;
  const cachedResult = appCache.get(cacheKey);
  if (cachedResult) return cachedResult;

  try {
    const tracks = await fetchAllPlaylistTracks(playlist.id, accessToken);
    const totalDuration = tracks.reduce((sum, item) => sum + item.track.duration_ms, 0);
    const result = { ...playlist, totalDuration, calculatedTracks: tracks.length, error: false };
    appCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.warn(`Error calculating duration for playlist ${playlist.id}:`, error.message);
    return { ...playlist, totalDuration: 0, calculatedTracks: 0, error: true };
  }
};

/**
 * Gestore della rotta per la pagina principale delle playlist, con LOG DI DEBUG.
 */
const getPlaylistsPage = async (req, res) => {
  const accessToken = req.session.accessToken;
  if (!accessToken) {
    return res.redirect('/start');
  }

  const page = validatePageNumber(req.query.page);

  try {
    const allPlaylists = await fetchAllUserPlaylists(accessToken);

    // DEBUG: Controlliamo l'array completo prima di qualsiasi elaborazione
    console.log(`DEBUG getPlaylistsPage: Array completo di playlist ricevuto: ${allPlaylists.length} elementi.`);
    
    allPlaylists.sort((a, b) => (b.tracks?.total || 0) - (a.tracks?.total || 0));

    const totalPages = Math.ceil(allPlaylists.length / PLAYLISTS_PER_PAGE);
    const paginatedPlaylists = allPlaylists.slice(
      (page - 1) * PLAYLISTS_PER_PAGE,
      page * PLAYLISTS_PER_PAGE
    );
    
    // DEBUG: Controlliamo l'array dopo la paginazione
    console.log(`DEBUG getPlaylistsPage: Paginazione applicata. Pagina: ${page}, Totale Pagine: ${totalPages}. ` +
                `Elementi in questa pagina: ${paginatedPlaylists.length}`);

    const html = renderPlaylistsPage(paginatedPlaylists, page, totalPages);
    res.send(html);

  } catch (err) {
    console.error('ERRORE CRITICO in getPlaylistsPage:', err.message, err.stack);
    if (err.message === 'UNAUTHORIZED') {
      req.session.destroy();
      return res.redirect('/start');
    }
    handleError(res, 'Impossibile recuperare le playlist.');
  }
};


/**
 * Gestore della rotta per la pagina di dettaglio di una singola playlist.
 */
const getPlaylistDetailPage = async (req, res) => {
  const { id: playlistId } = req.params;
  const accessToken = req.session.accessToken;

  if (!validatePlaylistId(playlistId)) return handleError(res, 'ID playlist non valido', 400);
  if (!accessToken) return res.redirect('/start');

  const view = req.query.view === 'artist' ? 'artist' : 'album';
  const page = validatePageNumber(req.query.page);

  try {
    const [playlistInfo, allTracks] = await Promise.all([
      makeSpotifyRequest(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}`, accessToken),
      fetchAllPlaylistTracks(playlistId, accessToken)
    ]);

    const totalDurationMs = allTracks.reduce((sum, item) => sum + (item.track?.duration_ms || 0), 0);
    const albumsMap = new Map();
    const artistsMap = new Map();

    allTracks.forEach(item => {
      if (item?.track) {
        if (item.track.album) albumsMap.set(item.track.album.id, item.track.album);
        item.track.artists.forEach(artist => artistsMap.set(artist.id, artist));
      }
    });

    const stats = {
      totalTracks: allTracks.length,
      durationText: formatDuration(totalDurationMs),
      uniqueAlbumsCount: albumsMap.size,
      uniqueArtistsCount: artistsMap.size,
    };

    let contentData = [];
    let totalPages = 1;
    let totalAlbumsInPlaylist = 0;

    if (view === 'artist') {
      const artistCounts = {};
      allTracks.forEach(item => {
        item.track?.artists?.forEach(artist => {
          if (!artistCounts[artist.id]) {
            artistCounts[artist.id] = { id: artist.id, name: artist.name, trackCount: 0 };
          }
          artistCounts[artist.id].trackCount++;
        });
      });
      const sortedArtists = Object.values(artistCounts).sort((a, b) => b.trackCount - a.trackCount);
      contentData = sortedArtists.slice(0, MAX_ARTISTS_DISPLAYED);
    } else { // 'album' view
      const albumsInPlaylist = {};
      allTracks.forEach(item => {
        const album = item.track?.album;
        if (!album?.id) return;

        if (!albumsInPlaylist[album.id]) {
          albumsInPlaylist[album.id] = {
            id: album.id,
            name: album.name,
            image: album.images?.[0]?.url || '/placeholder.png',
            artist: album.artists.map(a => a.name).join(', '),
            totalTracks: album.total_tracks,
            tracksPresent: 0
          };
        }
        albumsInPlaylist[album.id].tracksPresent++;
      });
      
      Object.values(albumsInPlaylist).forEach(album => {
        album.percentage = album.totalTracks > 0 ? Math.round((album.tracksPresent / album.totalTracks) * 100) : 0;
      });
      
      const sortedAlbums = Object.values(albumsInPlaylist).sort((a, b) => b.tracksPresent - a.tracksPresent || a.name.localeCompare(b.name));
      totalAlbumsInPlaylist = sortedAlbums.length;
      totalPages = Math.ceil(sortedAlbums.length / ALBUMS_PER_PAGE);
      contentData = sortedAlbums.slice((page - 1) * ALBUMS_PER_PAGE, page * ALBUMS_PER_PAGE);
    }
    
    const viewData = {
      playlist: playlistInfo,
      stats: { ...stats, totalAlbums: totalAlbumsInPlaylist },
      view,
      page,
      contentData,
      totalPages
    };
    
    const html = renderPlaylistDetailPage(viewData);
    res.send(html);

  } catch (err) {
    console.error(`Error fetching playlist details for ${playlistId}:`, err.message, err.stack);
    if (err.message === 'UNAUTHORIZED') {
      req.session.destroy();
      return res.redirect('/start');
    }
    if (err.response?.status === 404) {
      return handleError(res, 'Playlist non trovata', 404);
    }
    handleError(res, "Errore nel recuperare i dettagli della playlist.");
  }
};

module.exports = {
  getPlaylistsPage,
  getPlaylistDetailPage,
  calculatePlaylistDuration,
};
