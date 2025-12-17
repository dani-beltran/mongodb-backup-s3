import { loadConfig } from "../config";
import { listBackups } from "../s3/s3-download";

export async function runListBackups(options: { bucket?: string }): Promise<void> {
  console.log("📋 MongoDB Backups - Listing...\n");

  try {
    const config = loadConfig({ bucket: options.bucket });
    const backups = await listBackups(config);

    if (backups.length === 0) {
      console.log("No backups found.");
    } else {
      console.log(`Found ${backups.length} backup(s):\n`);
      backups.forEach((b, i) => console.log(`   ${i + 1}. ${b}`));
    }

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Failed to list backups:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}