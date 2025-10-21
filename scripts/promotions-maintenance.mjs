#!/usr/bin/env node

/**
 * Promotions Maintenance Script
 * 
 * Runs the following maintenance tasks:
 * 1. Migrates existing promotions to the new schema
 * 2. Fetches and displays current active promotions
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env.local if present
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

try {
  config({ path: envPath });
} catch (error) {
  // .env.local is optional, continue without it
}

const API_BASE = process.env.API_BASE || 'https://greenhaus-admin.vercel.app/api';
const ADMIN_KEY = process.env.NEXT_PUBLIC_VITE_ADMIN_API_KEY;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message) {
  console.log('');
  log('='.repeat(60), colors.cyan);
  log(message, colors.bright);
  log('='.repeat(60), colors.cyan);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.cyan);
}

async function runMigration() {
  logHeader('Step 1: Migrating Promotions Schema');
  
  try {
    logInfo('Calling migration endpoint...');
    const response = await fetch(`${API_BASE}/promotions/migrate`, {
      method: 'POST',
      headers: {
        'x-admin-key': ADMIN_KEY,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        logError('Unauthorized - check your admin key');
        return null;
      }
      logError(`Migration failed with status ${response.status}`);
      return null;
    }
    
    const result = await response.json();
    
    logSuccess('Migration completed!');
    console.log('');
    log(`  Updated: ${colors.green}${result.updated}${colors.reset} promotions`);
    log(`  Skipped: ${colors.yellow}${result.skipped}${colors.reset} promotions`);
    log(`  Errors:  ${colors.red}${result.errors || 0}${colors.reset} issues`);
    
    return result;
  } catch (error) {
    logError(`Migration error: ${error.message}`);
    return null;
  }
}

async function fetchPromotions() {
  logHeader('Step 2: Fetching Active Promotions');
  
  try {
    const params = new URLSearchParams({
      env: 'prod',
      storeId: 'cookeville',
      limit: '10',
    });
    
    logInfo(`Fetching promotions from ${API_BASE}/promotions...`);
    const response = await fetch(`${API_BASE}/promotions?${params}`);
    
    if (!response.ok) {
      logError(`Failed to fetch promotions: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const promotions = await response.json();
    
    if (promotions.error) {
      logError(`API error: ${promotions.error}`);
      return null;
    }
    
    logSuccess(`Found ${promotions.length} active promotion(s)`);
    console.log('');
    
    if (promotions.length === 0) {
      log('  No active promotions found.', colors.yellow);
    } else {
      log('  Active Promotions:', colors.bright);
      console.log('');
      
      promotions.forEach((promo, index) => {
        log(`  ${index + 1}. ${promo.title}`, colors.green);
        if (promo.body) {
          log(`     ${promo.body}`, colors.reset);
        }
        if (promo.startsAt) {
          log(`     Starts: ${new Date(promo.startsAt).toLocaleString()}`, colors.cyan);
        }
        if (promo.endsAt) {
          log(`     Ends:   ${new Date(promo.endsAt).toLocaleString()}`, colors.cyan);
        }
        if (promo.ctaUrl) {
          log(`     CTA:    ${promo.ctaUrl}`, colors.cyan);
        }
        console.log('');
      });
    }
    
    return promotions;
  } catch (error) {
    logError(`Fetch error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('');
  log('🔧 Promotions Maintenance Script', colors.bright);
  log('   GreenHaus Admin', colors.cyan);
  console.log('');
  
  // Validate admin key
  if (!ADMIN_KEY) {
    logError('Admin key not found!');
    console.log('');
    logInfo('Please set NEXT_PUBLIC_VITE_ADMIN_API_KEY in your .env.local file');
    console.log('');
    process.exit(1);
  }
  
  logInfo(`Using API base: ${API_BASE}`);
  logInfo(`Admin key: ${ADMIN_KEY.substring(0, 4)}...${ADMIN_KEY.substring(ADMIN_KEY.length - 4)}`);
  
  // Step 1: Run migration
  const migrationResult = await runMigration();
  
  // Step 2: Fetch promotions
  const promotions = await fetchPromotions();
  
  // Summary
  logHeader('Summary');
  
  if (migrationResult) {
    logSuccess('Migration completed successfully');
  } else {
    logError('Migration failed or was skipped');
  }
  
  if (promotions) {
    logSuccess(`${promotions.length} active promotion(s) available`);
  } else {
    logError('Failed to fetch promotions');
  }
  
  console.log('');
  log('✨ Maintenance complete!', colors.green);
  console.log('');
  
  // Exit with appropriate code
  const exitCode = (migrationResult || promotions) ? 0 : 1;
  process.exit(exitCode);
}

// Run the script
main().catch((error) => {
  console.error('');
  logError(`Unhandled error: ${error.message}`);
  console.error(error.stack);
  console.error('');
  process.exit(1);
});

