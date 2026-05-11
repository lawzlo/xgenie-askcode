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

function escapeSql(value) {
  return value.replace(/'/g, "''");
}

function runPsql(sql, options = {}) {
  return execSync(`psql "${databaseUrl}" -v ON_ERROR_STOP=1 ${options.tuplesOnly ? '-t -A ' : ''}-c "${sql.replace(/"/g, '\\"')}"`, {
    stdio: options.stdio || 'pipe',
    encoding: 'utf-8'
  });
}

function runMigrationFile(filePath) {
  return execSync(`psql "${databaseUrl}" -v ON_ERROR_STOP=1 -f "${filePath}"`, {
    stdio: 'pipe',
    encoding: 'utf-8'
  });
}

runPsql(`
  CREATE TABLE IF NOT EXISTS public.schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

const appliedOutput = runPsql(
  'SELECT filename FROM public.schema_migrations ORDER BY filename',
  { tuplesOnly: true }
).trim();
const appliedMigrations = new Set(appliedOutput ? appliedOutput.split('\n').filter(Boolean) : []);

const hasExistingAppSchema = runPsql(
  "SELECT to_regclass('public.projects') IS NOT NULL",
  { tuplesOnly: true }
).trim() === 't';

if (appliedMigrations.size === 0 && hasExistingAppSchema) {
  const legacyMigrations = migrationFiles.filter(file => file.localeCompare('024_project_schema_repair.sql') < 0);
  for (const file of legacyMigrations) {
    runPsql(`INSERT INTO public.schema_migrations(filename) VALUES ('${escapeSql(file)}') ON CONFLICT DO NOTHING`);
    appliedMigrations.add(file);
  }
  console.log(`🧭 Existing schema detected; baselined ${legacyMigrations.length} legacy migration(s)`);
}

let successCount = 0;
let skipCount = 0;
let errorCount = 0;

for (const file of migrationFiles) {
  const filePath = path.join(migrationsDir, file);

  if (appliedMigrations.has(file)) {
    console.log(`  ⏭️  ${file} already recorded`);
    skipCount++;
    continue;
  }

  console.log(`  Applying: ${file}...`);

  try {
    runMigrationFile(filePath);
    runPsql(`INSERT INTO public.schema_migrations(filename) VALUES ('${escapeSql(file)}') ON CONFLICT DO NOTHING`);
    console.log(`  ✅ ${file} applied successfully`);
    successCount++;
  } catch (error) {
    const errorMessage = error.stderr ? error.stderr.toString() : error.message;

    console.error(`  ❌ ${file} failed:`);
    console.error(`     ${errorMessage.split('\n')[0]}`);
    errorCount++;
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
