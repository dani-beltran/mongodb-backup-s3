import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { createReadStream } from "fs";
import type { Config } from "../config";
import type { DumpResult } from "../mongo/mongodump";

export interface UploadResult {
  bucket: string;
  key: string;
  totalFiles: number;
  totalSize: number;
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }

  return arrayOfFiles;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export async function uploadToS3(
  config: Config,
  dumpResult: DumpResult
): Promise<UploadResult> {
  const s3Client = new S3Client({
    ...(config.aws.endpoint && {endpoint: config.aws.endpoint}),
    region: config.aws.region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });

  const files = getAllFiles(dumpResult.outputPath);
  let totalSize = 0;

  console.log(`☁️  Uploading ${files.length} files to S3...`);

  for (const filePath of files) {
    const relativePath = path.relative(dumpResult.outputPath, filePath);
    const s3Key = `${config.s3.prefix}/${dumpResult.databaseName}-${dumpResult.timestamp}/${relativePath}`;

    const fileStats = fs.statSync(filePath);
    totalSize += fileStats.size;

    const fileStream = createReadStream(filePath);

    const command = new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: s3Key,
      Body: fileStream,
      ContentType: "application/gzip",
      Metadata: {
        database: dumpResult.databaseName,
        timestamp: dumpResult.timestamp,
        originalPath: relativePath,
      },
    });

    await s3Client.send(command);
    console.log(`  ✓ Uploaded: ${s3Key} (${formatBytes(fileStats.size)})`);
  }

  const resultKey = `${config.s3.prefix}/${dumpResult.databaseName}-${dumpResult.timestamp}/`;

  console.log(`✅ Upload complete!`);
  console.log(`   📍 Location: s3://${config.s3.bucket}/${resultKey}`);
  console.log(`   📊 Total size: ${formatBytes(totalSize)}`);

  return {
    bucket: config.s3.bucket,
    key: resultKey,
    totalFiles: files.length,
    totalSize,
  };
}
