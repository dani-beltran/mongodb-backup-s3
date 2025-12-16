import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import type { Config } from "../config";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export interface DownloadResult {
  localPath: string;
  totalFiles: number;
  bucket: string;
  key: string;
}

function createS3Client(config: Config): S3Client {
  return new S3Client({
    region: config.aws.region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
    ...(config.aws.endpoint && { endpoint: config.aws.endpoint }),
  });
}

export async function listBackups(config: Config): Promise<string[]> {
  const client = createS3Client(config);

  // Ensure prefix ends with / to list contents, not the folder itself
  const prefix = config.s3.prefix.endsWith("/") ? config.s3.prefix : `${config.s3.prefix}/`;

  console.log(`📋 Listing backups in s3://${config.s3.bucket}/${prefix}`);

  const command = new ListObjectsV2Command({
    Bucket: config.s3.bucket,
    Prefix: prefix,
    Delimiter: "/",
  });

  const response = await client.send(command);
  const prefixes = response.CommonPrefixes?.map((p) => p.Prefix || "") || [];

  // Extract backup folder names (timestamps)
  const backups = prefixes
    .map((p) => {
      const parts = p.replace(prefix, "").split("/").filter(Boolean);
      return parts[0] || "";
    })
    .filter(Boolean)
    .sort()
    .reverse(); // Most recent first

  return backups;
}

export async function downloadFromS3(
  config: Config,
  backupName: string,
  targetDir: string
): Promise<DownloadResult> {
  const client = createS3Client(config);
  const s3Prefix = `${config.s3.prefix}/${backupName}`;

  console.log(`📥 Downloading backup from s3://${config.s3.bucket}/${s3Prefix}`);

  // List all objects in the backup folder
  const listCommand = new ListObjectsV2Command({
    Bucket: config.s3.bucket,
    Prefix: s3Prefix,
  });

  const listResponse = await client.send(listCommand);
  const objects = listResponse.Contents || [];

  if (objects.length === 0) {
    throw new Error(`No backup found at s3://${config.s3.bucket}/${s3Prefix}`);
  }

  console.log(`   Found ${objects.length} files to download`);

  // Ensure target directory exists
  const localBackupPath = path.join(targetDir, backupName);
  if (!fs.existsSync(localBackupPath)) {
    fs.mkdirSync(localBackupPath, { recursive: true });
  }

  let downloadedFiles = 0;

  for (const object of objects) {
    if (!object.Key) continue;

    // Calculate local file path
    const relativePath = object.Key.replace(s3Prefix, "").replace(/^\//, "");
    if (!relativePath) continue;

    const localFilePath = path.join(localBackupPath, relativePath);

    // Ensure directory exists
    const localDir = path.dirname(localFilePath);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    // Download file
    const getCommand = new GetObjectCommand({
      Bucket: config.s3.bucket,
      Key: object.Key,
    });

    const response = await client.send(getCommand);

    if (response.Body instanceof Readable) {
      const writeStream = fs.createWriteStream(localFilePath);
      await pipeline(response.Body, writeStream);
      downloadedFiles++;
      process.stdout.write(`\r   Downloaded: ${downloadedFiles}/${objects.length} files`);
    }
  }

  console.log(""); // New line after progress
  console.log(`✅ Download completed: ${downloadedFiles} files`);

  return {
    localPath: localBackupPath,
    totalFiles: downloadedFiles,
    bucket: config.s3.bucket,
    key: s3Prefix,
  };
}
