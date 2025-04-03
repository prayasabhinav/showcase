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
            .sort({ upvotes: -1 });
        res.json(items);
    } catch (err) {
        console.error('Error fetching items:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Helper function to check and update streaks
async function checkAndUpdateStreaks(userId) {
    const user = await User.findById(userId);
    if (!user) return;

    const now = new Date();
    const oneMonthAgo = new Date(now.setMonth(now.getMonth() - 1));
    const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));

    // Check project contributions
    const recentProjects = user.contributions.projects.filter(p => p.date >= oneMonthAgo);
    const projectStreak = recentProjects.length >= 3 && 
        recentProjects.every(p => p.count >= 1);

    // Check idea contributions
    const recentIdeas = user.contributions.ideas.filter(i => i.date >= oneWeekAgo);
    const ideaStreak = recentIdeas.length >= 3 && 
        recentIdeas.every(i => i.count >= 1);

    // Update streak points if both conditions are met
    if (projectStreak && ideaStreak) {
        user.streakPoints += 1;
        await user.save();
    }
}

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
            const existingMonth = user.contributions.projects.find(p => 
                p.date.getMonth() === monthStart.getMonth() && 
                p.date.getFullYear() === monthStart.getFullYear()
            );
            
            if (existingMonth) {
                existingMonth.count += 1;
            } else {
                user.contributions.projects.push({
                    date: monthStart,
                    count: 1
                });
            }
        } else {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            console.log('Week start:', weekStart);
            
            const existingWeek = user.contributions.ideas.find(i => 
                i.date.getTime() === weekStart.getTime()
            );
            
            if (existingWeek) {
                existingWeek.count += 1;
            } else {
                user.contributions.ideas.push({
                    date: weekStart,
                    count: 1
                });
            }
        }
        
        console.log('Updating user contributions');
        await user.save();
        console.log('User contributions updated');
        
        // Check and update streaks
        await checkAndUpdateStreaks(req.user._id);
        
        // Return the new item with populated creator
        const populatedItem = await Item.findById(newItem._id)
            .populate('createdBy', 'name');
            
        console.log('Sending response with populated item');
        res.status(201).json(populatedItem);
    } catch (err) {
        console.error('Error creating item:', err);
        console.error('Error stack:', err.stack);
        res.status(500).json({ 
            error: 'Failed to create item. Please try again.',
            details: err.message
        });
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

// Add new endpoint to get user's contribution stats
app.get('/api/user/stats', isAuthenticated, async (req, res) => {
    try {
        // Check MongoDB connection
        if (mongoose.connection.readyState !== 1) {
            console.error('MongoDB is not connected');
            return res.status(503).json({ error: 'Database connection error' });
        }

        console.log('\n=== Starting User Stats Calculation ===');
        console.log('Fetching stats for user:', req.user._id);
        
        // Ensure user._id is valid
        if (!mongoose.Types.ObjectId.isValid(req.user._id)) {
            console.error('Invalid user ID:', req.user._id);
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const user = await User.findById(req.user._id);
        
        if (!user) {
            console.error('User not found:', req.user._id);
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Initialize contributions if they don't exist
        if (!user.contributions) {
            console.log('Initializing empty contributions for user');
            user.contributions = {
                projects: [],
                ideas: []
            };
            await user.save();
        }
        
        console.log('\nUser Details:');
        console.log('ID:', user._id);
        console.log('Name:', user.name);
        console.log('Raw Contributions:', JSON.stringify(user.contributions, null, 2));
        
        const now = new Date();
        console.log('\nCurrent time:', now.toISOString());
        
        // Get current month's project count
        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        console.log('Current month start:', currentMonth.toISOString());
        
        console.log('\nChecking Project Contributions:');
        console.log('Total projects entries:', user.contributions.projects.length);
        
        // Find the current month's project count
        const monthProjects = user.contributions.projects.find(p => {
            if (!p.date) {
                console.log('Found project entry with no date:', p);
                return false;
            }
            const projectDate = new Date(p.date);
            console.log('Checking project entry:', {
                date: projectDate.toISOString(),
                count: p.count,
                matchesCurrentMonth: projectDate.getMonth() === currentMonth.getMonth(),
                matchesCurrentYear: projectDate.getFullYear() === currentMonth.getFullYear()
            });
            return projectDate.getMonth() === currentMonth.getMonth() && 
                   projectDate.getFullYear() === currentMonth.getFullYear();
        });
        
        console.log('\nFound month projects:', monthProjects ? {
            date: monthProjects.date.toISOString(),
            count: monthProjects.count
        } : 'None');
        
        // Get current week's idea count
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Start of current week
        console.log('\nCurrent week start:', weekStart.toISOString());
        
        // Find the current week's idea count
        const weekIdeas = user.contributions.ideas.find(i => {
            if (!i.date) {
                console.log('Found idea entry with no date:', i);
                return false;
            }
            const ideaDate = new Date(i.date);
            console.log('Checking idea entry:', {
                date: ideaDate.toISOString(),
                count: i.count,
                isInCurrentWeek: ideaDate >= weekStart && ideaDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
            });
            return ideaDate >= weekStart && ideaDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        });
        
        console.log('\nFound week ideas:', weekIdeas ? {
            date: weekIdeas.date.toISOString(),
            count: weekIdeas.count
        } : 'None');
        
        // Verify the actual number of projects in the database
        const actualProjectCount = await Item.countDocuments({
            type: 'project',
            createdBy: user._id,
            createdAt: {
                $gte: currentMonth,
                $lt: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
            }
        });
        
        console.log('\nActual project count from database:', actualProjectCount);
        
        const stats = {
            streakPoints: user.streakPoints || 0,
            currentMonthProjects: actualProjectCount, // Use actual count from database
            currentWeekIdeas: weekIdeas ? weekIdeas.count : 0
        };
        
        console.log('\nFinal Stats:', stats);
        console.log('=== End User Stats Calculation ===\n');
        
        res.json(stats);
    } catch (err) {
        console.error('Error fetching user stats:', err);
        console.error('Error stack:', err.stack);
        res.status(500).json({ 
            error: 'Failed to fetch user stats',
            details: err.message
        });
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
