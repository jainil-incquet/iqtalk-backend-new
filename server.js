const express = require('express');
const { ExpressPeerServer } = require('peer');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Serve the HTML client from /public
app.use(express.static(path.join(__dirname, 'public')));

// PeerJS signaling at /peerjs
const peerServer = ExpressPeerServer(server, {
  debug: false,
  allow_discovery: true,
  path: '/'
});
app.use('/peerjs', peerServer);

peerServer.on('connection',  c => console.log('[+]', c.getId()));
peerServer.on('disconnect',  c => console.log('[-]', c.getId()));

app.get('/health', (req, res) => res.json({ ok: true, time: new Date() }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`IQTalk running on port ${PORT}`));
