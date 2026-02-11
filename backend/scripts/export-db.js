import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbHost = process.env.DB_HOST || 'localhost';
const dbUser = process.env.DB_USER || 'root';
const dbPass = process.env.DB_PASS || '';
const dbName = process.env.DB_NAME || 'qacashield';
const outputFile = path.join(__dirname, '../database_backup.sql');

try {
    console.log(`Starting export of database: ${dbName}...`);
    
    // Construct mysqldump command
    // Note: --no-tablespaces is often needed if the user doesn't have PROCESS privilege
    const passwordPart = dbPass ? `-p${dbPass}` : '';
    const command = `mysqldump -h ${dbHost} -u ${dbUser} ${passwordPart} ${dbName} --no-tablespaces > "${outputFile}"`;
    
    execSync(command, { stdio: 'inherit' });
    
    console.log(`Successfully exported database to: ${outputFile}`);
} catch (error) {
    console.error('Failed to export database:', error.message);
    process.exit(1);
}
