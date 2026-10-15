const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

dotenv.config();

// Fail fast on missing configuration rather than on the first login
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy server/.env.example to server/.env and fill it in.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn('JWT_SECRET is shorter than 32 characters; use a long random value in production.');
}

const { notFound, errorHandler } = require('./middleware/error');

const clientOrigins = (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map((o) => o.trim());

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: clientOrigins,
    methods: ['GET', 'POST']
  }
});

// Render/Railway sit behind one proxy hop; needed for per-IP rate limits
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors({ origin: clientOrigins, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down' }
}));

const isObjectId = (value) => typeof value === 'string' && mongoose.isValidObjectId(value);

// Socket.io: read-only rooms for live scoreboards and tournament pages
io.on('connection', (socket) => {
  socket.on('joinMatch', (matchId) => {
    if (isObjectId(matchId)) socket.join(`match:${matchId}`);
  });
  socket.on('joinTournament', (tournamentId) => {
    if (isObjectId(tournamentId)) socket.join(`tournament:${tournamentId}`);
  });
});

// Attach io to the app so routes can access it: req.app.get('io')
app.set('io', io);

// API Routes
app.get('/', (req, res) => {
  res.json({ message: 'Village Cricket Club API is running' });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/players', require('./routes/players'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/uploads', require('./routes/uploads'));

app.use(notFound);
app.use(errorHandler);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cricket-club';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
