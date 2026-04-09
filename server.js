import './src/config/loadEnv.js';
import connectDB from './src/config/db.js';
import createApp from './src/app.js';

connectDB();

const app = createApp();
const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Servidor ejecutandose en el puerto ${PORT}`);
  });
}

export default app;
