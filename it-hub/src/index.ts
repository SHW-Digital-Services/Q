// Load dotenv early so any module that reads process.env on import sees values
import dotenv from 'dotenv';
dotenv.config();

// Dynamically import the server so dotenv is set before any module-level reads.
import('./server').then(mod => {
  // server starts on import
}).catch(err => {
  console.error('[IT Hub] Server startup failed:', err instanceof Error ? `${err.name}: ${err.message}` : 'Unknown error');
  process.exit(1);
});
