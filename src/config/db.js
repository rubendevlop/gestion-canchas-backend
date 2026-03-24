import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error('⚠️ ALERTA: La variable MONGO_URI no está configurada en este entorno (Vercel). La base de datos no se conectará.');
    return;
  }
  
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB Exitosamente');
  } catch (err) {
    console.error('❌ Error al conectar a MongoDB:', err.message);
  }
};

export default connectDB;
