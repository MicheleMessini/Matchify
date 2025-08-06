const express = require('express');
const { getPlaylistDuration } = require('../controllers/apiController');
const router = express.Router();

/**
 * Rotta API per ottenere la durata di una playlist.
 * Risponde a GET /api/duration/:playlistId
 */
router.get('/duration/:playlistId', getPlaylistDuration);

module.exports = router;
