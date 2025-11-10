const express = require('express');
const router = express.Router();

// Debug: verifica cosa viene importato
const controllerImports = require('../controllers/playlistController');
console.log('🔍 Controller imports:', Object.keys(controllerImports));

const { getPlaylistsPage, getPlaylistDetailPage } = controllerImports;

// Debug: verifica che le funzioni esistano
console.log('getPlaylistsPage:', typeof getPlaylistsPage);
console.log('getPlaylistDetailPage:', typeof getPlaylistDetailPage);

/**
 * Definisce le rotte principali dell'applicazione relative alla visualizzazione delle playlist.
 */

// ROTTA: GET /
router.get('/', getPlaylistsPage);

// ROTTA: GET /playlist/:id
router.get('/playlist/:id', getPlaylistDetailPage);

module.exports = router;
