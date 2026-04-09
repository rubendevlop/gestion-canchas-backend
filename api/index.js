import '../src/config/loadEnv.js';
import createApp from '../src/app.js';

const app = createApp({ connectDatabasePerRequest: true });
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Servidor ejecutandose en el puerto ${PORT}`);
  });
}

export default app;
