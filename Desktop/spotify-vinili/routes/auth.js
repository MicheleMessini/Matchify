const express = require('express');
const { getStartPage, login, handleCallback } = require('../controllers/authController');
const router = express.Router();

/**
 * Definisce le rotte per il flusso di autenticazione con Spotify.
 */

// ROTTA: GET /start
// DESCRIZIONE: Mostra la pagina iniziale da cui l'utente può avviare il login.
router.get('/start', getStartPage);

// ROTTA: GET /login
// DESCRIZIONE: Redirige l'utente alla pagina di autorizzazione di Spotify.
router.get('/login', login);

// ROTTA: GET /callback
// DESCRIZIONE: Gestisce la risposta da Spotify dopo che l'utente ha concesso l'autorizzazione.
router.get('/callback', handleCallback);


module.exports = router;
