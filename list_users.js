import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: './.env' }); // or .env.local

console.log('Connecting to: ', process.env.MONGO_URI ? 'URI found' : 'URI missing');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const db = mongoose.connection.db;
    const users = await db.collection('users').find({}).toArray();
    let out = `Found ${users.length} users:\n`;
    users.forEach(u => {
      out += `- ${u.email} | role: ${u.role} | uid: ${u.uid} | ownerStatus: ${u.ownerStatus}\n`;
    });
    fs.writeFileSync('users_output.txt', out);
    console.log('Saved to users_output.txt');
    process.exit(0);
  })
  .catch(err => {
    fs.writeFileSync('users_output.txt', err.toString());
    console.error(err);
    process.exit(1);
  });
