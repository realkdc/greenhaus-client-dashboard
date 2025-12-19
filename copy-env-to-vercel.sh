#!/bin/bash

# Script to copy environment variables from .env.local to Vercel project

if [ ! -f .env.local ]; then
  echo "Error: .env.local file not found"
  exit 1
fi

PROJECT_NAME="greenhaus-client-dashboard"

echo "Copying environment variables to Vercel project: $PROJECT_NAME"
echo "This will add variables for production, preview, and development environments"
echo ""

# Read .env.local and add each variable to Vercel
while IFS='=' read -r key value || [ -n "$key" ]; do
  # Skip empty lines and comments
  [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
  
  # Remove quotes from value if present
  value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  
  # Skip if key or value is empty
  [[ -z "$key" || -z "$value" ]] && continue
  
  echo "Adding $key..."
  
  # Add to production
  echo "$value" | npx vercel@latest env add "$key" production --yes 2>&1 | grep -v "password" || true
  
  # Add to preview  
  echo "$value" | npx vercel@latest env add "$key" preview --yes 2>&1 | grep -v "password" || true
  
  # Add to development
  echo "$value" | npx vercel@latest env add "$key" development --yes 2>&1 | grep -v "password" || true
  
done < .env.local

echo ""
echo "Done! Environment variables have been copied to Vercel."

