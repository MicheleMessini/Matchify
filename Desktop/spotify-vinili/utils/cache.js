const NodeCache = require('node-cache');

/**
 *  Questa è l'istanza unica e condivisa della nostra cache applicativa.
 *
 *  Configurazione:
 *  - stdTTL (Standard Time To Live): 900 secondi (15 minuti).
 *    Ogni dato inserito nella cache scadrà e verrà automaticamente rimosso dopo questo periodo.
 *    Questo è utile per evitare di servire dati troppo vecchi (es. la durata di una playlist
 *    che è stata modificata su Spotify).
 *
 *  - checkperiod: 120 secondi (2 minuti).
 *    La cache controllerà e rimuoverà i dati scaduti ogni 2 minuti.
 *
 *  Esportando direttamente l'istanza 'appCache', ci assicuriamo che ogni file
 *  che la importa stia usando lo stesso oggetto in memoria (pattern Singleton).
 */
const appCache = new NodeCache({ stdTTL: 900, checkperiod: 120 });

// Log per confermare che la cache è stata inizializzata una sola volta (utile per il debug)
console.log('Cache service initialized.');

module.exports = appCache;
