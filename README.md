# Project & Idea Showcase for IxD Department at Anant

A web application for showcasing projects and ideas from members of the IxD department at Anant University.

## Features

- Google login restricted to anu.edu.in domain
- Post projects with URL, title, and keywords
- Post ideas with description, optional reference URL, and keywords
- Upvote system for both projects and ideas
- Sorted display based on upvotes
- Minimal design with no JavaScript frameworks

## Setup for Development

1. Clone the repository
2. Create a `.env` file with the following variables:
   ```
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/ixd-showcase
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   SESSION_SECRET=your_session_secret
   ```
3. Install dependencies: `npm install`
4. Run the development server: `npm run dev`

## Google OAuth Setup

1. Go to the [Google Developer Console](https://console.developers.google.com/)
2. Create a new project
3. Navigate to "Credentials" and create OAuth 2.0 credentials
4. Set the authorized redirect URI to:
   - For local: `http://localhost:3000/auth/google/callback`
   - For production: `https://your-domain.com/auth/google/callback`
5. Copy the Client ID and Client Secret to your `.env` file

## Deployment on CapRover

### Prerequisites

1. A server with CapRover installed
2. MongoDB database (either on the same server or a managed service)

### Method 1: Deployment via Tar File

1. Create a tar file of your application:
   ```
   tar -czf ixd-showcase.tar.gz --exclude="node_modules" --exclude=".git" .
   ```

2. Log in to your CapRover dashboard

3. Go to "Apps" and select your app (or create a new one)

4. Navigate to the "Deployment" tab

5. Under "Method 3: Upload tar file", click "Choose File" and select your tar file

6. Click "Upload & Deploy"

7. Configure Environment Variables in the "App Configs" tab:
   - `PORT`: 80 (default for CapRover apps)
   - `NODE_ENV`: production
   - `MONGO_URI`: your-mongodb-connection-string
   - `GOOGLE_CLIENT_ID`: your-google-client-id
   - `GOOGLE_CLIENT_SECRET`: your-google-client-secret 
   - `SESSION_SECRET`: random-long-string

### Method 2: Deployment via CLI

1. Log in to your CapRover instance:
   ```
   caprover login
   ```

2. Build and prepare your application:
   ```
   npm run build
   ```

3. Deploy using the CapRover CLI:
   ```
   caprover deploy
   ```

4. Configure Environment Variables in CapRover dashboard as described in Method 1

### Important: Google OAuth Callback URL

After deployment, update your Google OAuth credentials with the new redirect URL:
```
https://your-app-name.your-captain-domain.com/auth/google/callback
```

### Admin Access

The delete-all functionality is only available to the administrator email: `prayas.abhinav@anu.edu.in`
