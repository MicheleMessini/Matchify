const { makeSpotifyRequest } = require('../services/spotifyService');
const appCache = require('../utils/cache');
const {
    validatePageNumber,
    validatePlaylistId,
    handleError,
    delay,
    CONFIG, // Usiamo CONFIG da helpers, è più pulito
    formatDuration
} = require('../utils/helpers');
const { renderPlaylistsPage, renderPlaylistDetailPage } = require('../views/playlistView');

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
      // Filtriamo per sicurezza, assicurandoci che ogni playlist abbia un ID
      const validPlaylists = data.items.filter(p => p && p.id);
      playlists.push(...validPlaylists);
    } else {
      console.warn('⚠️ La risposta API non contiene un array `items` valido. Interruzione del ciclo.');
      break; // Usciamo dal ciclo se la risposta non è valida
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


/**
 * Gestore della rotta per la pagina principale che elenca le playlist dell'utente, con LOG DI DEBUG.
 */
const getPlaylistsPage = async (req, res) => {
  const accessToken = req.session.accessToken;
  if (!accessToken) {
    return res.redirect('/start');
  }

  const page = validatePageNumber(req.query.page);
  // Usiamo la costante centralizzata da CONFIG
  const limit = CONFIG.PLAYLISTS_PER_PAGE; 

  try {
    const allPlaylists = await fetchAllUserPlaylists(accessToken);

    // DEBUG: Controlliamo l'array completo prima della paginazione
    console.log(`DEBUG getPlaylistsPage: Array completo di playlist prima di slice(): ${allPlaylists.length} elementi.`);
    
    // Ordina le playlist
    allPlaylists.sort((a, b) => (b.tracks?.total || 0) - (a.tracks?.total || 0));

    const totalPages = Math.ceil(allPlaylists.length / limit);
    const paginatedPlaylists = allPlaylists.slice(
      (page - 1) * limit,
      page * limit
    );
    
    // DEBUG: Controlliamo l'array dopo la paginazione
    console.log(`DEBUG getPlaylistsPage: Paginazione applicata. Pagina: ${page}, Totale Pagine: ${totalPages}. ` +
                `Elementi in questa pagina: ${paginatedPlaylists.length}`);

    if (allPlaylists.length > 0 && paginatedPlaylists.length === 0 && page > 1) {
      console.warn(`⚠️ Attenzione: la pagina ${page} è richiesta, ma non ci sono playlist. Forse l'utente è andato troppo avanti?`);
      // Potrebbe essere utile reindirizzare alla prima pagina in questo caso, ma per ora lo logghiamo.
    }

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


// ... (Il resto del file rimane identico) ...

const getPlaylistDetailPage = async (req, res) => {
    // La tua logica esistente va benissimo
    const { id: playlistId } = req.params;
  const accessToken = req.session.accessToken;

  if (!validatePlaylistId(playlistId)) {
    return handleError(res, 'ID playlist non valido', 400);
  }
  if (!accessToken) {
    return res.redirect('/start');
  }

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
          if (!artistCounts[artist.id]) artistCounts[artist.id] = { id: artist.id, name: artist.name, trackCount: 0 };
          artistCounts[artist.id].trackCount++;
        });
      });
      const sortedArtists = Object.values(artistCounts).sort((a, b) => b.trackCount - a.trackCount);
      contentData = sortedArtists.slice(0, CONFIG.MAX_ARTISTS_DISPLAYED);
    } else {
      const albumsInPlaylist = {};
      allTracks.forEach(item => {
        const album = item.track?.album;
        if (!album?.id) return;
        if (!albumsInPlaylist[album.id]) {
          albumsInPlaylist[album.id] = {
            id: album.id, name: album.name, image: album.images?.[0]?.url || '/placeholder.png', artist: album.artists.map(a => a.name).join(', '), totalTracks: album.total_tracks, tracksPresent: 0
          };
        }
        albumsInPlaylist[album.id].tracksPresent++;
      });
      Object.values(albumsInPlaylist).forEach(album => {
        album.percentage = album.totalTracks > 0 ? Math.round((album.tracksPresent / album.totalTracks) * 100) : 0;
      });
      const sortedAlbums = Object.values(albumsInPlaylist).sort((a, b) => b.tracksPresent - a.tracksPresent || a.name.localeCompare(b.name));
      totalAlbumsInPlaylist = sortedAlbums.length;
      totalPages = Math.ceil(sortedAlbums.length / CONFIG.ALBUMS_PER_PAGE);
      contentData = sortedAlbums.slice((page - 1) * CONFIG.ALBUMS_PER_PAGE, page * CONFIG.ALBUMS_PER_PAGE);
    }
    const viewData = {
      playlist: playlistInfo,
      stats: { ...stats, totalAlbums: totalAlbumsInPlaylist },
      view, page, contentData, totalPages
    };
    const html = renderPlaylistDetailPage(viewData);
    res.send(html);
  } catch (err) {
    console.error(`Error fetching playlist details for ${playlistId}:`, err.message, err.stack);
    if (err.message === 'UNAUTHORIZED') {
      req.session.destroy(); return res.redirect('/start');
    }
    if (err.response?.status === 404) return handleError(res, 'Playlist non trovata', 404);
    handleError(res, "Errore nel recuperare i dettagli della playlist.");
  }
};


module.exports = {
  getPlaylistsPage,
  getPlaylistDetailPage,
  // La funzione per la durata non sembra essere usata qui direttamente, ma è ok esportarla
  calculatePlaylistDuration, 
};
