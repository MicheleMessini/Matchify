// =================================================================
// --- 1. Importazioni e Configurazione Iniziale ---
// =================================================================
// Carica le variabili d'ambiente dal file .env all'inizio di tutto
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

// Importa tutti i router che abbiamo creato. Ogni router gestisce una
// sezione specifica dell'applicazione.
const authRoutes = require('./routes/auth');
const playlistRoutes = require('./routes/playlistRoutes');
const albumRoutes = require('./routes/albumRoutes');
const apiRoutes = require('./routes/apiRoutes');

// =================================================================
// --- 2. Inizializzazione dell'App Express ---
// =================================================================
const app = express();
const PORT = process.env.PORT || 3000;

// ---> INIZIO MODIFICA <---
// Fa in modo che Express si fidi degli header del proxy di Render.
// Questo è FONDAMENTALE per far funzionare i cookie sicuri delle sessioni
// in un ambiente di produzione.
app.set('trust proxy', 1);
// ---> FINE MODIFICA <---

// =================================================================
// --- 3. Configurazione dei Middleware ---
// =================================================================

// Middleware per servire file statici (CSS, immagini, JS lato client)
// Express cercherà i file richiesti nella cartella 'public'.
app.use(express.static(path.join(__dirname, 'public')));

// Middleware per la gestione delle sessioni.
// È fondamentale per mantenere l'utente loggato tra le diverse richieste.
// La 'secret' dovrebbe essere una stringa lunga e casuale per la sicurezza.
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false, // Non salvare la sessione se non è stata modificata
    saveUninitialized: true, // Salva le sessioni nuove, anche se vuote
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Usa cookie sicuri (HTTPS) in produzione
        maxAge: 1000 * 60 * 60 * 24 // Durata del cookie (es. 24 ore)
    }
}));

// =================================================================
// --- 4. Montaggio dei Router ---
// =================================================================

// Questo è il cuore della refactorizzazione. Diciamo a Express di usare
// un router specifico per ogni "ramo" del nostro sito.

// Usa il router di autenticazione per percorsi come /login, /callback, /start
app.use('/', authRoutes);

// Usa il router delle playlist per il percorso principale / e /playlist/:id
app.use('/', playlistRoutes);

// Monta il router degli album sul percorso /album.
// Quindi una rotta definita come '/:id' in albumRoutes diventerà '/album/:id'
// Include anche /album/proxy-image per il proxy delle immagini
app.use('/album', albumRoutes);

// Monta il router delle API sul percorso /api.
// Quindi una rotta '/duration/:id' in apiRoutes diventerà '/api/duration/:id'
app.use('/api', apiRoutes);

// =================================================================
// --- 5. Avvio del Server ---
// =================================================================
app.listen(PORT, () => {
    console.log(`🚀 Server in esecuzione su http://localhost:${PORT}`);
    
    // Un piccolo check per le variabili d'ambiente critiche
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        console.warn('⚠️  Attenzione: SPOTIFY_CLIENT_ID o SPOTIFY_CLIENT_SECRET non sono impostati nel file .env. L\'autenticazione fallirà.');
    }
    
    if (!process.env.SESSION_SECRET) {
        console.warn('⚠️  Attenzione: SESSION_SECRET non è impostato nel file .env. Le sessioni potrebbero non essere sicure.');
    }
});
