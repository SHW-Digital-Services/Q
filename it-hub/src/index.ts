// Load dotenv early so any module that reads process.env on import sees values
import dotenv from 'dotenv';
dotenv.config();

// Dynamically import the server so dotenv is set before any module-level reads.
import('./server').then(mod => {
  // server starts on import
}).catch(err => {
  console.error('Failed to start IT Hub server', err);
  process.exit(1);
});
