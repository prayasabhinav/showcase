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
    profilePicture: String,
    streakPoints: {
        type: Number,
        default: 0
    },
    contributions: {
        projects: [{
            date: Date,
            count: Number
        }],
        ideas: [{
            date: Date,
            count: Number
        }]
    }
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
    },
    upvoters: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        date: Date
    }],
    comments: [{
        text: String,
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        date: Date
    }]
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

const callbackURL = process.env.NODE_ENV === 'production'
    ? 'https://showcase.myplaceholder.in/auth/google/callback'
    : 'http://localhost:3000/auth/google/callback';

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: callbackURL
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
                _id: req.user._id,
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
        const items = await Item.find()
            .populate('createdBy', 'name')  // Populate only the name field
            .populate('upvoters.user', 'name')  // Populate upvoters' names
            .sort({ upvotes: -1 });
        res.json(items);
    } catch (err) {
        console.error('Error fetching items:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update the POST /api/items endpoint
app.post('/api/items', isAuthenticated, async (req, res) => {
    try {
        console.log('Received item submission:', req.body);
        const { type, title, url, keywords } = req.body;
        
        // Validate required fields
        if (!type || !title) {
            console.error('Missing required fields:', { type, title });
            return res.status(400).json({ error: 'Type and title are required' });
        }

        // Validate type
        if (!['project', 'idea'].includes(type)) {
            console.error('Invalid type:', type);
            return res.status(400).json({ error: 'Invalid type. Must be either "project" or "idea"' });
        }

        // Validate keywords
        if (!Array.isArray(keywords) || keywords.length === 0) {
            console.error('Invalid keywords:', keywords);
            return res.status(400).json({ error: 'At least one keyword is required' });
        }

        console.log('Creating new item for user:', req.user._id);
        
        // Create and save the new item
        const newItem = new Item({
            type,
            title,
            url: url || '',
            keywords,
            createdBy: req.user._id
        });
        
        console.log('Saving new item:', newItem);
        await newItem.save();
        console.log('Item saved successfully');

        // Update user's contribution count
        const now = new Date();
        const user = await User.findById(req.user._id);
        console.log('Found user:', user._id);

        if (type === 'project') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            // Find the current month's project count
            const monthIndex = user.contributions.projects.findIndex(p => 
                p.date.getMonth() === monthStart.getMonth() && 
                p.date.getFullYear() === monthStart.getFullYear()
            );
            
            if (monthIndex !== -1) {
                user.contributions.projects[monthIndex].count += 1;
            } else {
                user.contributions.projects.push({
                    date: monthStart,
                    count: 1
                });
            }
        } else {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            // Find the current week's idea count
            const weekIndex = user.contributions.ideas.findIndex(i => 
                i.date.getTime() === weekStart.getTime()
            );
            
            if (weekIndex !== -1) {
                user.contributions.ideas[weekIndex].count += 1;
            } else {
                user.contributions.ideas.push({
                    date: weekStart,
                    count: 1
                });
            }
        }
        
        await user.save();
        console.log('User contributions updated');

        res.status(201).json(newItem);
    } catch (err) {
        console.error('Error creating item:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Upvote an item
app.post('/api/items/:id/upvote', isAuthenticated, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        // Check if user is trying to upvote their own post
        if (item.createdBy.toString() === req.user._id.toString()) {
            return res.status(400).json({ error: 'You cannot upvote your own post' });
        }
        
        // Check if user has already upvoted
        const existingUpvote = item.upvoters.find(upvote => 
            upvote.user.toString() === req.user._id.toString()
        );
        
        if (existingUpvote) {
            return res.status(400).json({ error: 'You have already upvoted this item' });
        }
        
        // Add new upvote
        item.upvotes += 1;
        item.upvoters.push({
            user: req.user._id,
            date: new Date()
        });
        
        await item.save();
        
        // Populate the upvoters before sending response
        const populatedItem = await Item.findById(item._id)
            .populate('upvoters.user', 'name');
        
        res.json({ 
            upvotes: populatedItem.upvotes,
            upvoters: populatedItem.upvoters.map(upvote => ({
                name: upvote.user.name,
                date: upvote.date
            }))
        });
    } catch (err) {
        console.error('Error upvoting item:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete an item (admin or owner only)
app.delete('/api/items/:id', isAuthenticated, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Check if user is admin or the owner of the item
        if (req.user.email !== 'prayas.abhinav@anu.edu.in' && item.createdBy.toString() !== req.user._id.toString()) {
            console.log('Delete permission denied:', {
                userEmail: req.user.email,
                itemCreator: item.createdBy,
                isAdmin: req.user.email === 'prayas.abhinav@anu.edu.in'
            });
            return res.status(403).json({ error: 'You can only delete your own posts' });
        }

        // Update user's contribution count
        const user = await User.findById(item.createdBy);
        if (user) {
            const now = new Date();
            if (item.type === 'project') {
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                // Find the current month's project count
                const monthIndex = user.contributions.projects.findIndex(p => 
                    p.date.getMonth() === monthStart.getMonth() && 
                    p.date.getFullYear() === monthStart.getFullYear()
                );
                
                if (monthIndex !== -1) {
                    user.contributions.projects[monthIndex].count = Math.max(0, user.contributions.projects[monthIndex].count - 1);
                    if (user.contributions.projects[monthIndex].count === 0) {
                        user.contributions.projects.splice(monthIndex, 1);
                    }
                }
            } else {
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                // Find the current week's idea count
                const weekIndex = user.contributions.ideas.findIndex(i => 
                    i.date.getTime() === weekStart.getTime()
                );
                
                if (weekIndex !== -1) {
                    user.contributions.ideas[weekIndex].count = Math.max(0, user.contributions.ideas[weekIndex].count - 1);
                    if (user.contributions.ideas[weekIndex].count === 0) {
                        user.contributions.ideas.splice(weekIndex, 1);
                    }
                }
            }
            await user.save();
        }
        
        await item.deleteOne();
        console.log(`Item ${req.params.id} deleted by ${req.user.email}`);
        res.status(200).json({ message: 'Item deleted successfully' });
    } catch (err) {
        console.error('Error deleting item:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete all items (admin only)
app.delete('/api/items/delete-all', isAdmin, async (req, res) => {
    console.log('Delete all items request received from:', req.user.email);
    
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
        console.error('MongoDB is not connected');
        return res.status(503).json({ error: 'Database connection error' });
    }

    try {
        // Get all items before deleting to update user stats
        const items = await Item.find({});
        console.log(`Found ${items.length} items to delete`);
        
        // Reset all users' contribution counts
        console.log('Resetting user contribution counts');
        try {
            const updateResult = await User.updateMany({}, {
                $set: {
                    'contributions.projects': [],
                    'contributions.ideas': []
                }
            });
            console.log('User contributions reset result:', updateResult);
        } catch (updateError) {
            console.error('Error resetting user contributions:', {
                message: updateError.message,
                stack: updateError.stack,
                code: updateError.code
            });
            throw updateError;
        }
        
        // Delete all items
        console.log('Deleting all items');
        try {
            const deleteResult = await Item.deleteMany({});
            console.log('Items deletion result:', deleteResult);
            
            if (!deleteResult.acknowledged) {
                throw new Error('Delete operation was not acknowledged by MongoDB');
            }
        } catch (deleteError) {
            console.error('Error deleting items:', {
                message: deleteError.message,
                stack: deleteError.stack,
                code: deleteError.code
            });
            throw deleteError;
        }
        
        console.log('All items deleted successfully by admin:', req.user.email);
        res.status(200).json({ message: 'All items deleted successfully' });
    } catch (err) {
        console.error('Error in delete-all endpoint:', {
            message: err.message,
            stack: err.stack,
            timestamp: new Date().toISOString(),
            user: req.user.email,
            errorType: err.name,
            errorCode: err.code,
            mongoState: mongoose.connection.readyState
        });
        res.status(500).json({ 
            error: 'Server error',
            details: err.message,
            code: err.code
        });
    }
});

// Get user stats
app.get('/api/user/stats', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());

        const monthProjects = user.contributions.projects.find(p => 
            p.date.getMonth() === monthStart.getMonth() && 
            p.date.getFullYear() === monthStart.getFullYear()
        )?.count || 0;

        const weekIdeas = user.contributions.ideas.find(i => 
            i.date.getTime() === weekStart.getTime()
        )?.count || 0;

        res.json({
            monthProjects,
            weekIdeas
        });
    } catch (err) {
        console.error('Error getting user stats:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get upvoters for an item
app.get('/api/items/:id/upvoters', isAuthenticated, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id)
            .populate('upvoters.user', 'name');
        
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        const upvoters = item.upvoters.map(upvote => ({
            name: upvote.user.name,
            date: upvote.date
        }));
        
        res.json(upvoters);
    } catch (err) {
        console.error('Error fetching upvoters:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get comments for an item
app.get('/api/items/:id/comments', isAuthenticated, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id)
            .populate('comments.author', 'name');
        
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        res.json(item.comments);
    } catch (err) {
        console.error('Error fetching comments:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add a comment to an item
app.post('/api/items/:id/comments', isAuthenticated, async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Comment text is required' });
        }
        
        const item = await Item.findById(req.params.id);
        
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        const comment = {
            text,
            author: req.user._id,
            date: new Date()
        };
        
        item.comments.push(comment);
        await item.save();
        
        // Populate the author's name before sending the response
        await item.populate('comments.author', 'name');
        const newComment = item.comments[item.comments.length - 1];
        
        res.status(201).json(newComment);
    } catch (err) {
        console.error('Error adding comment:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete a comment
app.delete('/api/items/:itemId/comments/:commentId', isAuthenticated, async (req, res) => {
    try {
        const item = await Item.findById(req.params.itemId);
        
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        const commentIndex = item.comments.findIndex(comment => 
            comment._id.toString() === req.params.commentId
        );
        
        if (commentIndex === -1) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        // Check if user is the author of the comment
        if (item.comments[commentIndex].author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You can only delete your own comments' });
        }
        
        // Remove the comment
        item.comments.splice(commentIndex, 1);
        await item.save();
        
        res.json({ message: 'Comment deleted successfully' });
    } catch (err) {
        console.error('Error deleting comment:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Helper function to get start of week
const getStartOfWeek = () => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(now.getDate() - now.getDay());
    return start;
};

// Helper function to get start of month
const getStartOfMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return start;
};

// Get leaderboard data
app.get('/api/leaderboard', async (req, res) => {
    try {
        const { type = 'posts' } = req.query;
        const startOfWeek = getStartOfWeek();
        const startOfMonth = getStartOfMonth();

        let leaderboardData = [];

        if (type === 'posts') {
            // Get users with most posts this week
            leaderboardData = await Item.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startOfWeek }
                    }
                },
                {
                    $group: {
                        _id: '$createdBy',
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { count: -1 }
                },
                {
                    $limit: 10
                }
            ]);
        } else if (type === 'upvotes') {
            // Get users with most upvotes this month
            leaderboardData = await Item.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startOfMonth }
                    }
                },
                {
                    $group: {
                        _id: '$createdBy',
                        count: { $sum: '$upvotes' }
                    }
                },
                {
                    $sort: { count: -1 }
                },
                {
                    $limit: 10
                }
            ]);
        } else if (type === 'comments') {
            // Get users with most comments this month
            leaderboardData = await Item.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startOfMonth }
                    }
                },
                {
                    $unwind: '$comments'
                },
                {
                    $group: {
                        _id: '$comments.author',
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { count: -1 }
                },
                {
                    $limit: 10
                }
            ]);
        }

        // Get user details for each entry
        const userIds = leaderboardData.map(entry => entry._id);
        const users = await User.find({ _id: { $in: userIds } });
        const userMap = users.reduce((acc, user) => {
            acc[user._id.toString()] = user;
            return acc;
        }, {});

        // Combine user details with leaderboard data
        const result = leaderboardData.map((entry, index) => ({
            rank: index + 1,
            user: userMap[entry._id.toString()] || { name: 'Unknown User', email: 'unknown@example.com' },
            score: entry.count
        }));

        res.json(result);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard data' });
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
