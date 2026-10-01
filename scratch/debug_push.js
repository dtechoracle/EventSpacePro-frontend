const fs = require('fs');
const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ODVkNmQ2NjY4MjhmM2YwNTMwYThiYSIsImVtYWlsIjoiYWJpb2xhLmF3b2xhamFAZXZlbnRzcGFjZXByby5jb20iLCJ0eXAiOiJhY2Nlc3MiLCJ2ZXIiOjAsImlhdCI6MTc5MDc3Nzc0OCwiZXhwIjoxNzkxMzgyNTQ4LCJhdWQiOiJldmVudHNwYWNlcHJvLWFwaSIsImlzcyI6ImV2ZW50c3BhY2Vwcm8ifQ.fUuGU7i9PPDpeElSS_7pNHhEV2fq0lyKCbcynyscZnQ';
const testEventId = '6abc2db304c5dbf56132e258';
const raw = JSON.parse(fs.readFileSync('scratch/chika_raw.json', 'utf8'));

function doPut(label, bodyObj) {
  return new Promise((resolve) => {
    const data = JSON.stringify(bodyObj);
    const req = https.request(`https://eventspacepro-backend.onrender.com/api/events/${testEventId}`, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let b = '';
      res.on('data', chunk => b += chunk);
      res.on('end', () => {
        console.log(`${label}: HTTP ${res.statusCode} -> ${b.slice(0, 150)}`);
        resolve(res.statusCode);
      });
    });
    req.on('error', e => {
      console.log(`${label}: Error ${e.message}`);
      resolve(500);
    });
    req.write(data);
    req.end();
  });
}

async function run() {
  const pBoth = {
    name: raw.name,
    eventName: raw.eventName,
    type: raw.type,
    canvases: raw.canvases,
    canvasAssets: raw.canvasAssets,
    canvasData: raw.canvasData
  };
  await doPut('Both canvasAssets and canvasData', pBoth);
}

run();
