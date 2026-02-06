const { makeSpotifyRequest } = require('../services/spotifyService');
const { validatePlaylistId, handleError } = require('../utils/helpers');
const { renderGenresPage } = require('../views/genresView');

/**
 * Elabora i generi dalle tracce della playlist
 */
const processGenres = (tracks, artistsGenres) => {
  const genreCount = {};
  let totalGenres = 0;

  tracks.forEach(track => {
    if (!track.track) return;
    
    track.track.artists.forEach(artist => {
      const genres = artistsGenres[artist.id] || [];
      genres.forEach(genre => {
        genreCount[genre] = (genreCount[genre] || 0) + 1;
        totalGenres++;
      });
    });
  });

  // Converti in array e calcola percentuali
  const genresArray = Object.entries(genreCount)
    .map(([name, count]) => ({
      name,
      count,
      percentage: (count / totalGenres) * 100
    }))
    .sort((a, b) => b.count - a.count);

  return genresArray;
};

/**
 * Gestisce la richiesta per la pagina dei generi
 */
const getPlaylistGenres = async (req, res) => {
  const { id: playlistId } = req.params;
  const accessToken = req.session.accessToken;

  // 1. Validazione e Autenticazione
  if (!validatePlaylistId(playlistId)) {
    return handleError(res, 'ID playlist non valido', 400);
  }
  if (!accessToken) {
    return res.redirect('/start');
  }

  try {
    // 2. Recupera i dati della playlist
    const playlist = await makeSpotifyRequest(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}`,
      accessToken
    );

    // 3. Recupera tutte le tracce della playlist
    let allTracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=50`;
    
    while (nextUrl) {
      const data = await makeSpotifyRequest(nextUrl, accessToken);
      allTracks = allTracks.concat(data.items);
      nextUrl = data.next;
    }

    // 4. Estrai gli ID univoci degli artisti
    const artistIds = new Set();
    allTracks.forEach(track => {
      if (track.track) {
        track.track.artists.forEach(artist => artistIds.add(artist.id));
      }
    });

    // 5. Recupera i generi di tutti gli artisti (in batch di 50)
    const artistsArray = Array.from(artistIds);
    const artistsGenres = {};
    
    for (let i = 0; i < artistsArray.length; i += 50) {
      const batch = artistsArray.slice(i, i + 50);
      const artistsData = await makeSpotifyRequest(
        `https://api.spotify.com/v1/artists?ids=${batch.join(',')}`,
        accessToken
      );
      
      artistsData.artists.forEach(artist => {
        if (artist) {
          artistsGenres[artist.id] = artist.genres || [];
        }
      });
    }

    // 6. Elabora i generi
    const genresData = processGenres(allTracks, artistsGenres);

    // 7. Prepara i dati per la vista
    const viewData = {
      playlistId,
      playlistName: playlist.name,
      genresData: genresData.slice(0, 15), // Top 15 generi
    };

    // 8. Renderizza la pagina
    const html = renderGenresPage(viewData);
    res.send(html);

  } catch (err) {
    console.error('Error fetching playlist genres:', err.message);
    if (err.message === 'UNAUTHORIZED') {
      req.session.destroy();
      return res.redirect('/start');
    }
    handleError(res, 'Errore nel recupero dei generi della playlist.');
  }
};

module.exports = {
  getPlaylistGenres,
};
