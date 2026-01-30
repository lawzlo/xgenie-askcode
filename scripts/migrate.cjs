#!/usr/bin/env node

/**
 * AskCode Database Migration Script
 *
 * Automatically runs SQL migrations on startup using psql.
 * Designed to be idempotent - safe to run multiple times.
 *
 * Requirements:
 * - psql must be installed and in PATH
 * - DATABASE_URL environment variable must be set
 *
 * Usage:
 *   npm run migrate          # Run migrations only
 *   npm run dev              # Run migrations then start server
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file for local development
// In production (Dokploy), environment variables are provided by the platform
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, override: false });
}

console.log('🔄 Starting database migrations...');

// Check for DATABASE_URL
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (supabaseUrl) {
    console.log('ℹ️  DATABASE_URL not set. Checking SUPABASE_URL...');
    console.log('');
    console.log('⚠️  To enable automatic migrations, add DATABASE_URL to your .env file.');
    console.log('   Format: postgresql://postgres:{password}@{host}:5432/postgres');
    console.log('');
    console.log('   For Dokploy: use internal service name like:');
    console.log('   postgresql://postgres:{password}@{project}-supabase-db:5432/postgres');
    console.log('');
    console.log('💡 For now, please run migrations manually in Supabase SQL Editor:');
    console.log(`   ${path.join(__dirname, '..', 'supabase', 'migrations')}`);
    console.log('');
  } else {
    console.log('⚠️  DATABASE_URL is not set. Skipping migrations.');
  }
  console.log('🚀 Starting application...');
  console.log(`📍 Access URL: http://localhost:${process.env.PORT || 3000}\n`);
  process.exit(0);
}

// Clean DATABASE_URL (remove Prisma-specific parameters)
if (databaseUrl.includes('?schema=')) {
  databaseUrl = databaseUrl.split('?')[0];
  console.log('ℹ️  Cleaned DATABASE_URL (removed query parameters)');
}

// Check if psql is available
try {
  execSync('which psql', { stdio: 'pipe' });
} catch {
  console.log('⚠️  psql not found in PATH. Please install PostgreSQL client tools.');
  console.log('');
  console.log('   macOS:   brew install postgresql');
  console.log('   Ubuntu:  sudo apt-get install postgresql-client');
  console.log('   Alpine:  apk add postgresql-client');
  console.log('');
  console.log('💡 Or run migrations manually in Supabase SQL Editor:');
  console.log(`   ${path.join(__dirname, '..', 'supabase', 'migrations')}`);
  console.log('');
  console.log('🚀 Starting application...');
  console.log(`📍 Access URL: http://localhost:${process.env.PORT || 3000}\n`);
  process.exit(0);
}

// Check migrations directory
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
if (!fs.existsSync(migrationsDir)) {
  console.log('⚠️  No migrations directory found. Skipping migrations.');
  console.log('🚀 Starting application...');
  console.log(`📍 Access URL: http://localhost:${process.env.PORT || 3000}\n`);
  process.exit(0);
}

// Read and sort migration files
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .sort();

if (migrationFiles.length === 0) {
  console.log('📝 No migration files found.');
  console.log('🚀 Starting application...');
  console.log(`📍 Access URL: http://localhost:${process.env.PORT || 3000}\n`);
  process.exit(0);
}

console.log(`📝 Found ${migrationFiles.length} migration file(s)`);

let successCount = 0;
let skipCount = 0;
let errorCount = 0;

for (const file of migrationFiles) {
  const filePath = path.join(migrationsDir, file);
  console.log(`  Applying: ${file}...`);

  try {
    // Use -v ON_ERROR_STOP=1 to make psql exit on SQL errors
    execSync(`psql "${databaseUrl}" -v ON_ERROR_STOP=1 -f "${filePath}"`, {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    console.log(`  ✅ ${file} applied successfully`);
    successCount++;
  } catch (error) {
    const errorMessage = error.stderr ? error.stderr.toString() : error.message;

    // Check for common "already applied" patterns
    if (errorMessage.includes('already exists') ||
        errorMessage.includes('duplicate key') ||
        errorMessage.includes('multiple primary keys')) {
      console.log(`  ⏭️  ${file} already applied (skipped)`);
      skipCount++;
    } else {
      console.error(`  ❌ ${file} failed:`);
      console.error(`     ${errorMessage.split('\n')[0]}`);
      errorCount++;
    }
  }
}

// Final report
console.log('');
if (errorCount === 0) {
  console.log(`✨ Migration complete: ${successCount} applied, ${skipCount} skipped`);
} else {
  console.log(`⚠️  Migration complete: ${successCount} applied, ${skipCount} skipped, ${errorCount} errors`);
  console.log('   Some migrations had errors. Check the output above.');
}

console.log('🚀 Starting application...');
console.log(`📍 Access URL: http://localhost:${process.env.PORT || 3000}\n`);
