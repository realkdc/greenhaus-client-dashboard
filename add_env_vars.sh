#!/bin/bash

TEAM_ID="team_trivWiQrucBbKsPDhObKF3wz"
PROJECT_ID="prj_NnJKqzAfThikuGNCkbmUECNvs5ac"

while IFS='=' read -r key value || [ -n "$key" ]; do
  line=$(echo "$key" | trim)
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  
  # Strip quotes
  value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  
  if [ "$key" == "VERCEL_OIDC_TOKEN" ]; then continue; fi

  echo "Adding $key..."
  # Add to all environments
  echo "y" | npx vercel@latest env add "$key" production 2>/dev/null
  echo "y" | npx vercel@latest env add "$key" preview 2>/dev/null
  echo "y" | npx vercel@latest env add "$key" development 2>/dev/null
done < .env.local
