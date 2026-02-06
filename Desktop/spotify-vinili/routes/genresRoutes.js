const express = require('express');
const { getPlaylistGenres } = require('../controllers/genresController');
const router = express.Router();

/**
 * Definisce le rotte relative ai generi.
 */

// ROTTA: GET /playlists/:id/genres
// DESCRIZIONE: Mostra la pagina di visualizzazione dei generi della playlist
router.get('/:id/genres', getPlaylistGenres);

module.exports = router;
