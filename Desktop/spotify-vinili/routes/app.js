const express = require('express');
const { makeSpotifyRequest } = require('../services/spotifyService');
const { escapeHtml, validatePageNumber, validatePlaylistId, validateAlbumId, handleError } = require('../utils/helpers');
const router = express.Router();


// Qui incolli tutto il codice delle rotte che hai già scritto:
// router.get('/', ...);
// router.get('/playlist/:id', ...);
// router.get('/album/:id', ...);

// Main playlist view
router.get('/', async (req, res) => {
    // ... INCOLLA QUI TUTTO IL CODICE DELLA TUA ROTTA app.get('/')
    // sostituendo 'app.get' con 'router.get'
    const accessToken = req.session.accessToken;
    const page = validatePageNumber(req.query.page);
    try {
        // ...il resto del codice non cambia...
    } catch(err) {
        // ...il resto del codice non cambia...
    }
});


// Playlist detail view
router.get('/playlist/:id', async (req, res) => {
    // ... INCOLLA QUI TUTTO IL CODICE DELLA TUA ROTTA app.get('/playlist/:id')
    // sostituendo 'app.get' con 'router.get'
    const playlistId = req.params.id;
    if (!validatePlaylistId(playlistId)) {
        // ...il resto del codice non cambia...
    }
    // ...
});

// Album detail view
router.get('/album/:id', async (req, res) => {
    // ... INCOLLA QUI TUTTO IL CODICE DELLA TUA ROTTA app.get('/album/:id')
    // sostituendo 'app.get' con 'router.get'
    const albumId = req.params.id;
    if (!validateAlbumId(albumId)) {
        // ...il resto del codice non cambia...
    }
    // ...
});


module.exports = router;
