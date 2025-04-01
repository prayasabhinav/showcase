# Deployment Guide for IxD Project Showcase

This guide provides detailed steps for deploying the application using a tar file on CapRover.

## Prerequisites

1. [CapRover](https://caprover.com/) installed on your server
2. MongoDB database (either on the same server or a cloud service like MongoDB Atlas)
3. Google OAuth credentials set up for your domain

## Option 1: Automated Deployment Script (Recommended)

We've created a comprehensive deployment script that handles all steps of the deployment process:

1. Create a `.env.production` file with your production environment variables:
   ```
   PORT=80
   NODE_ENV=production
   MONGO_URI=your_production_mongodb_connection_string
   GOOGLE_CLIENT_ID=your_production_google_client_id
   GOOGLE_CLIENT_SECRET=your_production_google_client_secret
   SESSION_SECRET=your_secure_random_string
   ```

2. Run the deployment script:
   ```
   npm run deploy
   ```

3. Follow the interactive prompts in the script:
   - The script will check for uncommitted changes
   - Create a deployment tar file
   - Provide the option to upload directly to CapRover or guide you through manual upload
   - Remind you about environment variables and OAuth settings

The script offers two deployment methods:
- **Manual Upload**: Creates the tar file and guides you to upload it through the CapRover dashboard
- **Automated Upload**: Uses curl to upload the tar file directly to your CapRover instance (requires your CapRover password)

## Option 2: Manual Deployment

If you prefer to handle each step manually, follow these instructions:

### Step 1: Prepare Your Application for Deployment

1. Update the Google OAuth callback URL in your Google Developer Console to match your production domain:
   ```
   https://your-app-name.your-captain-domain.com/auth/google/callback
   ```

2. Create a `.env.production` file with production values (do NOT commit this file):
   ```
   PORT=80
   NODE_ENV=production
   MONGO_URI=your_production_mongodb_connection_string
   GOOGLE_CLIENT_ID=your_production_google_client_id
   GOOGLE_CLIENT_SECRET=your_production_google_client_secret
   SESSION_SECRET=your_secure_random_string
   ```

### Step 2: Create a Deployment Tar File

1. Run the npm script to create a tar file (not compressed):
   ```
   npm run create-tar
   ```
   
   This creates `ixd-showcase.tar` containing all necessary files (excluding node_modules, .git, .env, etc.)

### Step 3: Deploy on CapRover

1. Log in to your CapRover dashboard (typically at https://captain.your-domain.com)

2. Create a new app if you haven't already:
   - Go to "Apps" and click "Create New App"
   - Enter a name for your app (e.g., "ixd-showcase")
   - Enable "Has Persistent Data" if you want to store uploaded files
   - Click "Create New App"

3. Deploy your application:
   - Go to your app's dashboard
   - Navigate to the "Deployment" tab
   - Under "Method 3: Upload tar file", click "Choose File" 
   - Select your `ixd-showcase.tar` file
   - Click "Upload & Deploy"

4. Configure Environment Variables:
   - Navigate to the "App Configs" tab
   - Under "Environmental Variables", add all variables from your `.env.production` file
   - Set PORT to 80 (CapRover default)
   - Click "Save & Update"

5. Configure App Domain:
   - Navigate to the "HTTP Settings" tab
   - Enable HTTPS if not already enabled
   - Add your custom domain if needed

## Step 4: Verify Deployment

1. Visit your application at https://your-app-name.your-captain-domain.com

2. Check logs for any errors:
   - Go to the "Deployment" tab
   - Click "View App Logs" to see your application logs

## Troubleshooting

### Authentication Issues
- Verify that your Google OAuth callback URL is correct
- Check that environment variables are properly set

### Database Connection Issues
- Ensure your MongoDB URI is correct
- Verify that your MongoDB instance is accessible from your CapRover server

### Application Errors
- Check the application logs in the CapRover dashboard
- SSH into your CapRover instance and check container logs if needed 