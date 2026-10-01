const fs = require('fs');
const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ODVkNmQ2NjY4MjhmM2YwNTMwYThiYSIsImVtYWlsIjoiYWJpb2xhLmF3b2xhamFAZXZlbnRzcGFjZXByby5jb20iLCJ0eXAiOiJhY2Nlc3MiLCJ2ZXIiOjAsImlhdCI6MTc5MDc3Nzc0OCwiZXhwIjoxNzkxMzgyNTQ4LCJhdWQiOiJldmVudHNwYWNlcHJvLWFwaSIsImlzcyI6ImV2ZW50c3BhY2Vwcm8ifQ.fUuGU7i9PPDpeElSS_7pNHhEV2fq0lyKCbcynyscZnQ';

const testEventId = '6abc2db304c5dbf56132e258';
const payload = JSON.parse(fs.readFileSync('scratch/chika_raw.json', 'utf8'));

const payloadStr = JSON.stringify(payload);

console.log(`Sending PUT to /events/${testEventId} for Chika & Tife test:`);
console.log(`- canvasAssets count: ${payload.canvasAssets?.length || 0}`);
console.log(`- shapes count: ${payload.canvasData?.shapes?.length || 0}`);
console.log(`- assets count: ${payload.canvasData?.assets?.length || 0}`);
console.log(`- textAnnotations count: ${payload.canvasData?.textAnnotations?.length || 0}`);

const req = https.request(`https://eventspacepro-backend.onrender.com/api/events/${testEventId}`, {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payloadStr)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Response Status:', res.statusCode);
    try {
      const parsed = JSON.parse(body);
      console.log('Response Message:', parsed.message);
      console.log('Saved canvasAssets in DB:', parsed.data?.canvasAssets?.length);
    } catch(e) {
      console.log('Response Body:', body);
    }
  });
});

req.on('error', (e) => {
  console.error('Request Error:', e);
});

req.write(payloadStr);
req.end();
