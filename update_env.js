const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read .env.local to parse the values manually to be safe
const envContent = fs.readFileSync('.env.local', 'utf8');

function getEnvValue(key) {
  const match = envContent.match(new RegExp(`${key}="([^"]+)"`));
  return match ? match[1] : null;
}

const googleKey = getEnvValue("GOOGLE_DRIVE_PRIVATE_KEY");
const firebaseKey = getEnvValue("FIREBASE_PRIVATE_KEY");

if (!googleKey) {
  console.error("Could not find GOOGLE_DRIVE_PRIVATE_KEY in .env.local");
  process.exit(1);
}

// Helper to update env var
function updateEnv(name, value) {
  console.log(`Updating ${name}...`);
  try {
    // We remove it first to avoid duplicates/conflicts (optional but cleaner)
    try {
        execSync(`npx vercel env rm ${name} production -y`);
    } catch (e) {
        // Ignore if it doesn't exist
    }

    // Add it back. We pass the value via stdin.
    // We want to pass the literal string with "\n" characters as seen in the file, 
    // because our code expects that and handles the replacement.
    const child = require('child_process').spawn('npx', ['vercel', 'env', 'add', name, 'production'], {
      stdio: ['pipe', 'inherit', 'inherit']
    });

    child.stdin.write(value);
    child.stdin.end();

    return new Promise((resolve, reject) => {
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Failed to add ${name}`));
        });
    });
  } catch (error) {
    console.error(`Error updating ${name}:`, error);
  }
}

async function run() {
    await updateEnv("GOOGLE_DRIVE_PRIVATE_KEY", googleKey);
    // Also update FIREBASE_PRIVATE_KEY just in case
    if (firebaseKey) {
        await updateEnv("FIREBASE_PRIVATE_KEY", firebaseKey);
    }
    console.log("Environment variables updated successfully.");
}

run();
