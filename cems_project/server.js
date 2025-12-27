const express = require('express');
const db = require('./db/database');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();
const app = express();
app.use(express.static('public'));
app.use(cors());
app.use(express.json());
app.use(session({
    secret: 'cyplocal_secret_key',
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:5001/auth/google/callback"
}, (at, rt, profile, done) => done(null, profile)));
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
// Rotalar
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/index.html' }), (req, res) => res.redirect('/home.html'));
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [results] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (results.length > 0 && results[0].password === password) {
            return res.json({ success: true, redirect: "/home.html" });
        }
        res.status(401).json({ message: "Invalid credentials!" });
    } catch (error) { res.status(500).json({ message: "Server error." }); }
});
app.post('/api/signup', async (req, res) => {
    const { email, password, phone } = req.body;
    try {
        await db.execute('INSERT INTO users (email, password, phone) VALUES (?, ?, ?)', [email, password, phone]);
        res.json({ success: true, message: "Welcome to CypLocal!" });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: "Email already registered." });
        res.status(500).json({ message: "Database error." });
    }
});
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`CypLocal running: http://localhost:${PORT}`));
const nodemailer = require('nodemailer');
// Gmail configuration for Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'seninmailin@gmail.com', // Your Gmail address
        pass: 'uygulama-sifresi' // Your 16-character App Password

    }
});
// Memory storage for OTPs (In production, use Redis or Database)
let otpStore = {}; 
// API Route to send verification code

app.post('/api/send-otp', async (req, res) => {

    const { email } = req.body;
    // Generate 6-digit random code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Store code with email key

    otpStore[email] = verificationCode;

    const mailOptions = {
        from: 'CypLocal Support <seninmailin@gmail.com>',
        to: email,
        subject: 'Your Password Reset Code',
        html: `
            <div style="font-family: sans-serif; text-align: center;">
                <h2>Password Reset Request</h2>
                <p>Use the code below to reset your password:</p>
                <h1 style="color: #6C94DC;">${verificationCode}</h1>
                <p>If you didn't request this, please ignore this email.</p>
            </div>
        `
    };
    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: "Code sent successfully!" });
    } catch (error) {
        console.error("Email Error:", error);
        res.status(500).json({ success: false, message: "Failed to send email." });
    }
});

// API Route to verify the code
app.post('/api/verify-otp', (req, res) => {
    const { email, code } = req.body;
    if (otpStore[email] === code) {
        // Success! Remove code after verification
        delete otpStore[email];
        res.json({ success: true, message: "Code verified!" });
    } else {
        res.status(400).json({ success: false, message: "Invalid or expired code." });
    }
});











// Final step: Update the password in MySQL
app.post('/api/update-password', async (req, res) => {
    const { email, newPassword } = req.body;

    try {
        // SQL query to update user password based on email
        const sql = 'UPDATE users SET password = ? WHERE email = ?';
        const [result] = await db.execute(sql, [newPassword, email]);

        if (result.affectedRows > 0) {
            res.json({ success: true, message: "Password updated successfully!" });
        } else {
            res.status(404).json({ success: false, message: "User not found." });
        }
    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ success: false, message: "Database update failed." });
    }
});






app.get('/api/events', async (req, res) => {
    const sortType = req.query.sort;
    const now = new Date(); // The current date

    let sql = "";
    
    if (sortType === 'newest') {
        // NOT YET OCCURRED: The most recently added to the system (with the largest ID) is at the top
        sql = "SELECT * FROM events WHERE event_date >= NOW() ORDER BY created_at DESC";
    } 
    else if (sortType === 'oldest') {
        // NOT YET COMPLETED: The first item added to the system appears at the top.
        sql = "SELECT * FROM events WHERE event_date >= NOW() ORDER BY created_at ASC";
    } 
    else if (sortType === 'past') {
        // HISTORICAL BACKGROUND: From the most recent to the most distant (From New to Old)
        sql = "SELECT * FROM events WHERE event_date < NOW() ORDER BY event_date DESC";
    }

    try {
        const [rows] = await db.execute(sql);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});