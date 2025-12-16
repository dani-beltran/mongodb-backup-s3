import { spawn } from "child_process";
import type { Config } from "../config";

export interface RestoreResult {
  databaseName: string;
  sourcePath: string;
}

export async function runMongoRestore(
  config: Config,
  backupPath: string,
  options: { drop: boolean }
): Promise<RestoreResult> {
  console.log(`📦 Starting mongorestore for database: ${config.mongodb.database}`);
  console.log(`📁 Source path: ${backupPath}`);

  const mongorestorePath = config.mongodumpPath.replace("mongodump", "mongorestore");

  const args = [
    "--uri",
    config.mongodb.uri,
    "--db",
    config.mongodb.database,
    "--gzip",
    `${backupPath}/${config.mongodb.database}`,
  ];

  if (options.drop) {
    args.push("--drop");
    console.log("⚠️  Drop option enabled: existing collections will be dropped before restore");
  }

  return new Promise((resolve, reject) => {
    const mongorestore = spawn(mongorestorePath, args);

    let stderr = "";

    mongorestore.stdout.on("data", (data) => {
      console.log(`mongorestore: ${data}`);
    });

    mongorestore.stderr.on("data", (data) => {
      stderr += data.toString();
      // mongorestore outputs progress to stderr
      process.stderr.write(data);
    });

    mongorestore.on("close", (code) => {
      if (code === 0) {
        console.log("✅ mongorestore completed successfully");
        resolve({
          databaseName: config.mongodb.database,
          sourcePath: backupPath,
        });
      } else {
        reject(new Error(`mongorestore failed with code ${code}: ${stderr}`));
      }
    });

    mongorestore.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new Error(
            `mongorestore not found. Please install MongoDB Database Tools or ensure it's in your PATH.`
          )
        );
      } else {
        reject(err);
      }
    });
  });
}
