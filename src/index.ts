#!/usr/bin/env node
import { program } from "commander";
import { runListBackups } from "./commands/list";
import { runRestore } from "./commands/restore";
import { runDump } from "./commands/dump";

// Get package version dynamically
const packageJson = require("../package.json");

program
  .name("mongodb-backup-s3")
  .description("CLI tool to backup and restore MongoDB databases using S3 as storage")
  .version(packageJson.version, "-v, --version", "Output the current version");

program
  .command("dump")
  .description("Create a backup of the MongoDB database and upload to S3")
  .option("-k, --keep-local", "Keep local backup files after upload", false)
  .option("-B, --bucket <name>", "S3 bucket name (overrides S3_BUCKET env var)")
  .action(runDump);

program
  .command("restore")
  .description("Restore a MongoDB database from an S3 backup")
  .option("-b, --backup <name>", "Specific backup folder name to restore (defaults to most recent)")
  .option("-d, --drop", "Drop existing collections before restore", false)
  .option("-k, --keep-local", "Keep downloaded backup files after restore", false)
  .option("-B, --bucket <name>", "S3 bucket name (overrides S3_BUCKET env var)")
  .action(runRestore);

program
  .command("list")
  .description("List available backups in S3")
  .option("-B, --bucket <name>", "S3 bucket name (overrides S3_BUCKET env var)")
  .action(runListBackups);

program.parse();
