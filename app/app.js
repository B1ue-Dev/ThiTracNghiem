const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
    secret: 'thi-trac-nghiem-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000, secure: true, sameSite: 'strict' } // 1 hour
}));

// Routes
const authRoutes = require('./routes/auth');
const monhocRoutes = require('./routes/monhoc');
const lopRoutes = require('./routes/lop');
const sinhvienRoutes = require('./routes/sinhvien');
const giaovienRoutes = require('./routes/giaovien');
const cauhoiRoutes = require('./routes/cauhoi');
const thiRoutes = require('./routes/thi');
const ketquaRoutes = require('./routes/ketqua');
const reportRoutes = require('./routes/report');
app.use('/', authRoutes);
app.use('/', monhocRoutes);
app.use('/', lopRoutes);
app.use('/', sinhvienRoutes);
app.use('/', giaovienRoutes);
app.use('/', cauhoiRoutes);
app.use('/', thiRoutes);
app.use('/', ketquaRoutes);
app.use('/api/report', reportRoutes);
// Serve HTML views
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Catch-all: redirect to home (Express v5 syntax)
app.get('/{*path}', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.redirect('/');
    }
});

// Start server
const PORT = process.env.PORT || 3000;
const { initJsReport } = require('./jsreport-service');

const WIDTH = 42;

function boxLine(text = "") {
    return `║ ${text.padEnd(WIDTH)} ║`;
}

initJsReport().then(() => {
    app.listen(PORT, () => {
        console.log(`╔${'═'.repeat(WIDTH + 2)}╗`);
        console.log(boxLine('HỆ THỐNG THI TRẮC NGHIỆM'));
        console.log(boxLine(`Server đang chạy: http://localhost:${PORT}`));
        console.log(`╚${'═'.repeat(WIDTH + 2)}╝`);
        console.log();
    });
}).catch(err => {
    console.error('Failed to initialize jsreport:', err);
});

module.exports = app;
