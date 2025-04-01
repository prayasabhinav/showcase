#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}==========================================${NC}"
echo -e "${GREEN}IxD Project Showcase Deployment Script${NC}"
echo -e "${BLUE}==========================================${NC}"

# Check if .env.production exists and create it if needed
if [ ! -f ".env.production" ]; then
  echo -e "${YELLOW}Warning: .env.production file not found.${NC}"
  echo -e "This file is needed for production environment variables."
  
  read -p "Would you like to create a .env.production file now? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "Creating .env.production file..."
    
    # Prompt for required environment variables
    read -p "MongoDB URL (e.g. mongodb://user:pass@host:port/db): " MANGODB_URL
    read -p "Google OAuth Client ID: " GOOGLE_CLIENT_ID
    read -p "Google OAuth Client Secret: " GOOGLE_CLIENT_SECRET
    read -p "Session Secret (random string): " SESSION_SECRET
    
    # Create the .env.production file
    cat > .env.production << EOL
PORT=80
NODE_ENV=production
MANGODB_URL=${MANGODB_URL}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
SESSION_SECRET=${SESSION_SECRET}
EOL
    
    echo -e "${GREEN}.env.production file created successfully!${NC}"
  else
    read -p "Continue deployment without .env.production? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi

# Check for uncommitted changes
echo -e "${BLUE}Checking for uncommitted changes...${NC}"
if [[ -d .git ]]; then
  if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}You have uncommitted changes:${NC}"
    git status -s
    read -p "Continue without committing these changes? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  else
    echo -e "${GREEN}No uncommitted changes found.${NC}"
  fi
fi

# Create the tar file
echo -e "${BLUE}Creating deployment tar file...${NC}"
npm run create-tar
if [ $? -ne 0 ]; then
  echo -e "${RED}Error creating tar file!${NC}"
  exit 1
fi
echo -e "${GREEN}Successfully created ixd-showcase.tar${NC}"

# Check the file size
FILE_SIZE=$(du -h ixd-showcase.tar | cut -f1)
echo -e "${BLUE}Tar file size: ${GREEN}$FILE_SIZE${NC}"

# Ask for CapRover app name
read -p "Enter your CapRover app name (e.g. ixd-showcase): " CAPROVER_APP_NAME
if [ -z "$CAPROVER_APP_NAME" ]; then
  echo -e "${RED}App name cannot be empty!${NC}"
  exit 1
fi

# Ask for CapRover URL
read -p "Enter your CapRover dashboard URL (e.g. https://captain.yourdomain.com): " CAPROVER_URL
if [ -z "$CAPROVER_URL" ]; then
  echo -e "${RED}CapRover URL cannot be empty!${NC}"
  exit 1
fi

# Ask if user wants to upload using the script
echo
echo -e "${YELLOW}You have two options for deployment:${NC}"
echo "1. Upload the tar file manually through the CapRover dashboard"
echo "2. Use this script to upload the tar file (requires curl)"
read -p "Choose option (1/2): " UPLOAD_OPTION

if [ "$UPLOAD_OPTION" = "2" ]; then
  # Check if curl is installed
  if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is not installed. Please install curl or use manual upload.${NC}"
    exit 1
  fi
  
  # Ask for CapRover password
  read -sp "Enter your CapRover password: " CAPROVER_PASSWORD
  echo
  
  # Login to CapRover and get token
  echo -e "${BLUE}Logging in to CapRover...${NC}"
  LOGIN_RESPONSE=$(curl -s -X POST "$CAPROVER_URL/api/v2/login" \
    -H "Content-Type: application/json" \
    -d "{\"password\":\"$CAPROVER_PASSWORD\"}")
  
  TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | grep -o '[^"]*$')
  
  if [ -z "$TOKEN" ]; then
    echo -e "${RED}Login failed! Please check your CapRover URL and password.${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}Successfully logged in to CapRover!${NC}"
  
  # Upload tar file
  echo -e "${BLUE}Uploading tar file to CapRover...${NC}"
  echo -e "${YELLOW}This may take a while depending on your file size and internet speed...${NC}"
  
  UPLOAD_RESPONSE=$(curl -s -X POST "$CAPROVER_URL/api/v2/user/apps/deploytarball" \
    -H "X-Captain-Auth: $TOKEN" \
    -F "appName=$CAPROVER_APP_NAME" \
    -F "tarFile=@ixd-showcase.tar")
  
  if [[ $UPLOAD_RESPONSE == *"\"status\":100"* ]]; then
    echo -e "${GREEN}Tar file uploaded successfully!${NC}"
    echo -e "${BLUE}Deployment is in progress. Check the CapRover dashboard for status.${NC}"
  else
    echo -e "${RED}Error uploading tar file!${NC}"
    echo -e "${RED}Response: $UPLOAD_RESPONSE${NC}"
    exit 1
  fi
else
  echo -e "${BLUE}Please upload the tar file manually through the CapRover dashboard:${NC}"
  echo -e "1. Go to ${YELLOW}$CAPROVER_URL${NC}"
  echo -e "2. Navigate to Apps > $CAPROVER_APP_NAME > Deployment"
  echo -e "3. Select Method 3: Upload tar file"
  echo -e "4. Choose ixd-showcase.tar and click 'Upload & Deploy'"
fi

# Reminder about environment variables
echo
echo -e "${YELLOW}IMPORTANT:${NC} Don't forget to set your environment variables in the CapRover dashboard!"
echo -e "Make sure these variables are properly configured:"
echo -e "- ${GREEN}PORT${NC}: 80"
echo -e "- ${GREEN}NODE_ENV${NC}: production"
echo -e "- ${GREEN}MANGODB_URL${NC}: your MongoDB connection string"
echo -e "- ${GREEN}GOOGLE_CLIENT_ID${NC}: your Google OAuth client ID"
echo -e "- ${GREEN}GOOGLE_CLIENT_SECRET${NC}: your Google OAuth client secret"
echo -e "- ${GREEN}SESSION_SECRET${NC}: your session secret"

# Google OAuth reminder
echo
echo -e "${YELLOW}IMPORTANT:${NC} Update your Google OAuth callback URL to:"
echo -e "${GREEN}https://$CAPROVER_APP_NAME.yourdomain.com/auth/google/callback${NC}"

echo
echo -e "${BLUE}==========================================${NC}"
echo -e "${GREEN}Deployment process completed!${NC}"
echo -e "${BLUE}==========================================${NC}" 