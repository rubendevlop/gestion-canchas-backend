import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();
mongoose.set('bufferCommands', false);

const globalMongoose = globalThis;

if (!globalMongoose.__mongooseCache) {
  globalMongoose.__mongooseCache = { conn: null, promise: null };
}

const connectDB = async () => {
  if (globalMongoose.__mongooseCache.conn) {
    return globalMongoose.__mongooseCache.conn;
  }

  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI no esta configurada. La base de datos no se conectara.');
    return null;
  }

  try {
    if (!globalMongoose.__mongooseCache.promise) {
      globalMongoose.__mongooseCache.promise = mongoose
        .connect(process.env.MONGO_URI)
        .then((mongooseInstance) => {
          console.log('Conectado a MongoDB exitosamente');
          return mongooseInstance;
        });
    }

    globalMongoose.__mongooseCache.conn = await globalMongoose.__mongooseCache.promise;
    return globalMongoose.__mongooseCache.conn;
  } catch (err) {
    globalMongoose.__mongooseCache.promise = null;
    console.error('Error al conectar a MongoDB:', err.message);
    return null;
  }
};

export default connectDB;
