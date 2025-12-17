import path from "path";
import fs from "fs";
import { loadConfig } from "../config";
import { runMongoRestore } from "../mongo/mongorestore";
import { downloadFromS3, listBackups } from "../s3/s3-download";

export async function runRestore(options: { backup?: string; drop: boolean; keepLocal: boolean; bucket?: string; prefix?: string }): Promise<void> {
  const startTime = Date.now();

  console.log("🔄 MongoDB Restore from S3 - Starting...\n");

  try {
    const config = loadConfig({ bucket: options.bucket, prefix: options.prefix });
    console.log(`📋 Configuration loaded`);
    console.log(`   Database: ${config.mongodb.database}`);
    console.log(`   S3 Bucket: ${config.s3.bucket}`);
    console.log(`   S3 Prefix: ${config.s3.prefix}\n`);

    let backupName = options.backup;

    // If no backup specified, list available backups and use the most recent
    if (!backupName) {
      const backups = await listBackups(config);
      if (backups.length === 0) {
        throw new Error("No backups found in S3");
      }
      console.log(`\n📁 Available backups:`);
      backups.slice(0, 10).forEach((b, i) => console.log(`   ${i + 1}. ${b}`));
      if (backups.length > 10) {
        console.log(`   ... and ${backups.length - 10} more`);
      }
      backupName = backups[0];
      console.log(`\n🎯 Using most recent backup: ${backupName}\n`);
    }

    // Download backup from S3
    const restoreDir = path.join(process.cwd(), "restores");
    if (!fs.existsSync(restoreDir)) {
      fs.mkdirSync(restoreDir, { recursive: true });
    }

    const downloadResult = await downloadFromS3(config, backupName, restoreDir);
    console.log("");

    // Run mongorestore
    const restoreResult = await runMongoRestore(config, downloadResult.localPath, {
      drop: options.drop,
    });
    console.log("");

    // Cleanup downloaded files unless --keep-local is specified
    if (!options.keepLocal) {
      fs.rmSync(downloadResult.localPath, { recursive: true, force: true });
      console.log(`🧹 Cleaned up downloaded backup: ${downloadResult.localPath}`);
    } else {
      console.log(`📁 Downloaded backup kept at: ${downloadResult.localPath}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✨ Restore completed successfully in ${duration}s`);
    console.log(`   Database: ${restoreResult.databaseName}`);
    console.log(`   Source: s3://${downloadResult.bucket}/${downloadResult.key}`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Restore failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}