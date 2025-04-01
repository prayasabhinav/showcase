require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Add detailed startup logging
console.log('Starting application...');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PORT: ${PORT}`);

// Add a simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Check if required environment variables are present
const requiredEnvVars = ['MANGODB_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'SESSION_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`Error: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Connect to MongoDB with additional logging
console.log('Connecting to MongoDB...');
console.log(`MongoDB URL: ${process.env.MANGODB_URL.substring(0, 20)}...`); // Only show part of the URL for security

mongoose.connect(process.env.MANGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000 // Increase timeout for server selection
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if we can't connect to database
});

// Create mongoose models
const User = mongoose.model('User', new mongoose.Schema({
    googleId: String,
    name: String,
    email: String,
    profilePicture: String
}));

const Item = mongoose.model('Item', new mongoose.Schema({
    type: {
        type: String,
        enum: ['project', 'idea'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    url: String,
    keywords: [String],
    upvotes: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}));

// Configure session middleware
console.log('Configuring session middleware...');
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: process.env.MANGODB_URL,
        touchAfter: 24 * 3600 // Only update the session once per day unless data changes
    })
});
app.use(sessionMiddleware);

// Configure Passport.js
console.log('Configuring Passport.js...');
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production' 
        ? 'https://showcase.myplaceholder.in/auth/google/callback'
        : 'http://localhost:3000/auth/google/callback'
},
async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if email is from anu.edu.in domain
        const email = profile.emails[0].value;
        console.log(`Authentication attempt from email: ${email}`);
        
        if (!email.endsWith('@anu.edu.in')) {
            console.log(`Authentication rejected: ${email} not from anu.edu.in domain`);
            return done(null, false, { message: 'Only anu.edu.in emails are allowed' });
        }
        
        // Find or create user
        let user = await User.findOne({ googleId: profile.id });
        
        if (!user) {
            console.log(`Creating new user for: ${email}`);
            user = await User.create({
                googleId: profile.id,
                name: profile.displayName,
                email: email,
                profilePicture: profile.photos[0].value
            });
        } else {
            console.log(`Existing user found: ${email}`);
        }
        
        return done(null, user);
    } catch (err) {
        console.error('Error during authentication:', err);
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        console.error('Error deserializing user:', err);
        done(err);
    }
});

// Middleware
console.log('Setting up middleware...');
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Authentication routes
app.get('/auth/google',
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })
);

app.get('/auth/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/',
        successRedirect: '/'
    })
);

app.get('/auth/logout', (req, res) => {
    req.logout(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.redirect('/');
    });
});

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.email === 'prayas.abhinav@anu.edu.in') {
        return next();
    }
    res.status(403).json({ error: 'Admin access required' });
};

// API routes
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: {
                name: req.user.name,
                email: req.user.email,
                profilePicture: req.user.profilePicture
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Get all items
app.get('/api/items', isAuthenticated, async (req, res) => {
    try {
        const items = await Item.find().sort({ upvotes: -1 });
        res.json(items);
    } catch (err) {
        console.error('Error fetching items:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create a new item
app.post('/api/items', isAuthenticated, async (req, res) => {
    try {
        const { type, title, url, keywords } = req.body;
        
        const newItem = new Item({
            type,
            title,
            url,
            keywords,
            createdBy: req.user._id
        });
        
        await newItem.save();
        res.status(201).json(newItem);
    } catch (err) {
        console.error('Error creating item:', err);
        res.status(400).json({ error: err.message });
    }
});

// Upvote an item
app.post('/api/items/:id/upvote', isAuthenticated, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        item.upvotes += 1;
        await item.save();
        
        res.json({ upvotes: item.upvotes });
    } catch (err) {
        console.error('Error upvoting item:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete all items (admin only)
app.delete('/api/items/delete-all', isAdmin, async (req, res) => {
    try {
        await Item.deleteMany({});
        console.log('All items deleted by admin');
        res.status(200).json({ message: 'All items deleted successfully' });
    } catch (err) {
        console.error('Error deleting all items:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Serve the index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`Application started successfully!`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    
    // Close the server
    server.close(() => {
        console.log('HTTP server closed');
        
        // Close MongoDB connection
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });

    // Force close after 10 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

// Handle different termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});
