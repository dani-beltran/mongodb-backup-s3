#!/usr/bin/env node

import { program } from "commander";
import { loadConfig } from "./config";
import { createMongoDump, cleanupLocalBackup } from "./mongodump";
import { uploadToS3 } from "./s3-upload";

async function runBackup(options: { keepLocal: boolean }): Promise<void> {
  const startTime = Date.now();

  console.log("🚀 MongoDB Backup to S3 - Starting...\n");

  try {
    // Load configuration
    const config = loadConfig();
    console.log(`📋 Configuration loaded`);
    console.log(`   Database: ${config.mongodb.database}`);
    console.log(`   S3 Bucket: ${config.s3.bucket}`);
    console.log(`   S3 Prefix: ${config.s3.prefix}\n`);

    // Create mongodump
    const dumpResult = await createMongoDump(config);
    console.log("");

    // Upload to S3
    const uploadResult = await uploadToS3(config, dumpResult);
    console.log("");

    // Cleanup local backup unless --keep-local is specified
    if (!options.keepLocal) {
      cleanupLocalBackup(dumpResult.outputPath);
    } else {
      console.log(`📁 Local backup kept at: ${dumpResult.outputPath}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✨ Backup completed successfully in ${duration}s`);
    console.log(`   Files: ${uploadResult.totalFiles}`);
    console.log(`   Location: s3://${uploadResult.bucket}/${uploadResult.key}`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Backup failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

program
  .name("mongodb-backup-s3")
  .description("Backup MongoDB database and upload to S3")
  .version("1.0.0");

program
  .command("dump", { isDefault: true })
  .description("Create a backup of the MongoDB database and upload to S3")
  .option("-k, --keep-local", "Keep local backup files after upload", false)
  .action(runBackup);

program.parse();
