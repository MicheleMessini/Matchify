const { escapeHtml } = require('../utils/helpers');

/**
 * Genera l'HTML per la pagina di visualizzazione dei generi con pie chart
 */
const renderGenresPage = (viewData) => {
  const { playlistId, playlistName, genresData } = viewData;
  
  // Prepara i dati per Chart.js
  const labels = genresData.map(g => g.name);
  const data = genresData.map(g => g.percentage);
  const colors = [
    '#1db954', // verde Spotify
    '#ff6b6b', // rosso/rosa
    '#4ecdc4', // azzurro
    '#ffd93d', // giallo
    '#6bcf7f', // verde acqua
    '#ff8ed4', // rosa chiaro
    '#95e1d3', // menta
    '#f38181', // salmone
    '#a29bfe', // viola
    '#fd79a8', // rosa scuro
    '#fdcb6e', // arancione
    '#00b894', // verde smeraldo
  ];
  
  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Generi - ${escapeHtml(playlistName)}</title>
      <link rel="stylesheet" href="/genres.css">
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    </head>
    <body>
      <div class="container">
        
        <!-- Header con tab di navigazione -->
        <header class="genres-header">
          <h1>${escapeHtml(playlistName)}</h1>
          <nav class="view-tabs">
            <a href="/playlists/${escapeHtml(playlistId)}" class="tab">
              <span class="tab-icon">💿</span>
              Vista Album
            </a>
            <a href="/playlists/${escapeHtml(playlistId)}/artists" class="tab">
              <span class="tab-icon">👤</span>
              Vista Artisti
            </a>
            <a href="/playlists/${escapeHtml(playlistId)}/genres" class="tab active">
              <span class="tab-icon">🎵</span>
              Vista Generi
            </a>
          </nav>
        </header>
        
        <!-- Contenitore del grafico -->
        <main class="chart-container">
          <div class="chart-wrapper">
            <canvas id="genresPieChart"></canvas>
          </div>
          
          <!-- Legenda personalizzata -->
          <div class="genres-legend">
            ${genresData.map((genre, index) => `
              <div class="legend-item">
                <span class="legend-color" style="background-color: ${colors[index % colors.length]}"></span>
                <span class="legend-label">${escapeHtml(genre.name)}</span>
                <span class="legend-value">${genre.percentage.toFixed(1)}%</span>
              </div>
            `).join('')}
          </div>
        </main>
        
        <!-- Footer -->
        <footer class="text-center">
          <a href="/playlists" class="btn btn-back">← Torna alle Playlist</a>
        </footer>
        
      </div>
      
      <script>
        // Dati per il grafico
        const genresData = ${JSON.stringify({
          labels,
          data,
          colors
        })};
        
        // Configurazione Chart.js
        const ctx = document.getElementById('genresPieChart').getContext('2d');
        
        const chart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: genresData.labels,
            datasets: [{
              data: genresData.data,
              backgroundColor: genresData.colors,
              borderColor: '#191414',
              borderWidth: 3,
              hoverOffset: 20
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                display: false // Usiamo la legenda custom
              },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                borderColor: '#1db954',
                borderWidth: 2,
                padding: 12,
                displayColors: true,
                callbacks: {
                  label: function(context) {
                    return context.label + ': ' + context.parsed.toFixed(1) + '%';
                  }
                }
              }
            },
            animation: {
              animateRotate: true,
              animateScale: true,
              duration: 1500,
              easing: 'easeInOutQuart'
            },
            cutout: '45%', // Per il doughnut chart (cerchio con buco)
          }
        });
        
        // Interattività: click sulla legenda
        document.querySelectorAll('.legend-item').forEach((item, index) => {
          item.addEventListener('click', () => {
            const meta = chart.getDatasetMeta(0);
            meta.data[index].hidden = !meta.data[index].hidden;
            chart.update();
            item.classList.toggle('disabled');
          });
        });
      </script>
    </body>
    </html>
  `;
};

module.exports = {
  renderGenresPage,
};
