import fs from 'fs';

const data = fs.readFileSync('firebase-key.json');
const base64 = Buffer.from(data).toString('base64');
fs.writeFileSync('firebase-base64.txt', base64);
console.log('Done');
