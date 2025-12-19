const fs = require('fs');
const { execSync } = require('child_process');

// Read .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) {
    let key = match[1];
    let value = match[2];
    
    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    envVars[key] = value;
  }
});

console.log(`Found ${Object.keys(envVars).length} environment variables to copy\n`);

// Get Vercel project info
const projectId = 'prj_NnJKqzAfThikuGNCkbmUECNvs5ac';
const teamId = 'team_trivWiQrucBbKsPDhObKF3wz';

console.log('To copy these environment variables to Vercel, you have two options:\n');
console.log('OPTION 1: Use Vercel Dashboard (Recommended)');
console.log(`1. Go to: https://vercel.com/realkdcs-projects/greenhaus-client-dashboard/settings/environment-variables`);
console.log('2. Add each variable manually\n');

console.log('OPTION 2: Use Vercel CLI (Interactive)');
console.log('Run this command for each variable:\n');

Object.entries(envVars).forEach(([key, value]) => {
  console.log(`echo "${value.replace(/"/g, '\\"')}" | npx vercel@latest env add ${key} production`);
  console.log(`echo "${value.replace(/"/g, '\\"')}" | npx vercel@latest env add ${key} preview`);
  console.log(`echo "${value.replace(/"/g, '\\"')}" | npx vercel@latest env add ${key} development`);
  console.log('');
});

console.log('\nOr use the Vercel Dashboard URL above to add them all at once.');

