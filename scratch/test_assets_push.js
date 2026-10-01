const fs = require('fs');
const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ODVkNmQ2NjY4MjhmM2YwNTMwYThiYSIsImVtYWlsIjoiYWJpb2xhLmF3b2xhamFAZXZlbnRzcGFjZXByby5jb20iLCJ0eXAiOiJhY2Nlc3MiLCJ2ZXIiOjAsImlhdCI6MTc5MDc3Nzc0OCwiZXhwIjoxNzkxMzgyNTQ4LCJhdWQiOiJldmVudHNwYWNlcHJvLWFwaSIsImlzcyI6ImV2ZW50c3BhY2Vwcm8ifQ.fUuGU7i9PPDpeElSS_7pNHhEV2fq0lyKCbcynyscZnQ';
const testEventId = '6abc2db304c5dbf56132e258';
const raw = JSON.parse(fs.readFileSync('scratch/chika_raw.json', 'utf8'));

function doPut(bodyObj) {
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
        resolve({ status: res.statusCode, body: b });
      });
    });
    req.write(data);
    req.end();
  });
}

function doGet() {
  return new Promise((resolve) => {
    const req = https.request(`https://eventspacepro-backend.onrender.com/api/events/${testEventId}`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res) => {
      let b = '';
      res.on('data', chunk => b += chunk);
      res.on('end', () => resolve(JSON.parse(b)));
    });
    req.end();
  });
}

async function test() {
  // Push canvasAssets first
  const pAssets = {
    name: raw.name,
    eventName: raw.eventName,
    type: raw.type,
    canvases: raw.canvases,
    canvasAssets: raw.canvasAssets
  };
  const res = await doPut(pAssets);
  console.log('PUT canvasAssets response:', res.status);
  
  const getRes = await doGet();
  console.log('GET canvasAssets count in DB:', getRes.data?.canvasAssets?.length);
  console.log('GET canvasData in DB:', getRes.data?.canvasData ? Object.keys(getRes.data.canvasData) : 'null/undefined');
}

test();
