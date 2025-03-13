// src/cluster.js
// Este archivo se puede usar en entornos que no sean serverless para escalar horizontalmente

const cluster = require('cluster');
const os = require('os');
const app = require('./index');

// Número de núcleos en la máquina
const numCPUs = os.cpus().length;

// Función para iniciar el clúster
function startCluster() {
  // Si es el proceso maestro
  if (cluster.isMaster) {
    console.log(`Proceso maestro ${process.pid} iniciado`);
    console.log(`Iniciando ${numCPUs} workers...`);

    // Crear un worker por CPU
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    // Manejar salida de workers
    cluster.on('exit', (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} terminado con código ${code} y señal ${signal}`);
      console.log('Iniciando nuevo worker...');
      cluster.fork(); // Reemplazar el worker caído
    });

    // Métricas básicas del clúster
    const workerStats = {};
    let totalRequests = 0;

    // Recibir mensajes de los workers
    Object.values(cluster.workers).forEach(worker => {
      worker.on('message', msg => {
        if (msg.cmd === 'STATS') {
          workerStats[worker.id] = msg.data;
          
          // Actualizar contador total
          if (msg.data.requestCount) {
            totalRequests += msg.data.requestCount;
          }
        }
      });
    });

    // Imprimir estadísticas cada minuto
    setInterval(() => {
      console.log('==== ESTADÍSTICAS DEL CLÚSTER ====');
      console.log(`Total de trabajadores: ${Object.keys(cluster.workers).length}`);
      console.log(`Peticiones totales: ${totalRequests}`);
      console.log('Estadísticas por worker:');
      
      Object.entries(workerStats).forEach(([id, stats]) => {
        console.log(`- Worker ${id}: ${stats.activeRequests} activas, ${stats.requestCount} totales`);
      });
      
      console.log('================================');
    }, 60000);

  } else {
    // Los procesos worker ejecutan la aplicación
    const PORT = process.env.PORT || 4000;
    
    // Métricas del worker
    const stats = {
      workerId: cluster.worker.id,
      startTime: Date.now(),
      requestCount: 0,
      activeRequests: 0
    };

    // Middleware para contar peticiones
    app.use((req, res, next) => {
      stats.requestCount++;
      stats.activeRequests++;
      
      // Enviar estadísticas al master cada 100 peticiones
      if (stats.requestCount % 100 === 0) {
        process.send({ 
          cmd: 'STATS', 
          data: { ...stats }
        });
      }
      
      // Detectar fin de petición
      res.on('finish', () => {
        stats.activeRequests--;
      });
      
      next();
    });

    // Escuchar en el puerto
    app.listen(PORT, () => {
      console.log(`Worker ${process.pid} escuchando en puerto ${PORT}`);
    });

    // Enviar estadísticas periódicamente
    setInterval(() => {
      process.send({ 
        cmd: 'STATS', 
        data: { ...stats }
      });
    }, 10000);
  }
}

// Solo usar en entornos no serverless
if (process.env.USE_CLUSTER === 'true' && process.env.NODE_ENV !== 'development') {
  startCluster();
} else {
  // Uso directo sin clúster
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Servidor único escuchando en puerto ${PORT}`);
  });
}

module.exports = { startCluster };