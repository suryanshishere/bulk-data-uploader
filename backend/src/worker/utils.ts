import csv from "csv-parser";
import { Store, IStore } from "@models/Store";
import { initMailer } from "./helpers";
import { IFileProcess } from "@models/FileProcess";
import { Emitter } from "@socket.io/redis-emitter";
import fs from "fs";

const BATCH_SIZE = 1000;

export async function processBatch(
  batch: Array<Partial<IStore>>,
  startRow: number
) {
  const results = await Promise.all(
    batch.map(async (doc, i) => {
      try {
        await Store.create(doc);
        return { inserted: 1, failed: 0, errors: [] };
      } catch (e: any) {
        return {
          inserted: 0,
          failed: 1,
          errors: [{ row: startRow + i, message: e.message }],
        };
      }
    })
  );
  return {
    inserted: results.reduce((sum, r) => sum + r.inserted, 0),
    failed: results.reduce((sum, r) => sum + r.failed, 0),
    errors: results.flatMap((r) => r.errors),
  };
}

export async function sendEmailSummary(
  transporter: ReturnType<typeof initMailer>,
  to: string,
  summary: any,
  pid: string
) {
  const html = `
    <h3>Upload Summary</h3>
    <p><a href="${
      process.env.FRONTEND_URL
    }/processed-file-data/${pid}" target="_blank">View Details</a></p>
    <p>Total: ${summary.total}</p>
    <p>Success: ${summary.success}</p>
    <p>Failed: ${summary.failed}</p>
    <ul>${summary.errors
      .map((e: any) => `<li>Row ${e.row}: ${e.message}</li>`)
      .join("")}</ul>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: "Bulk Data Processing Completed",
    html,
  });
}

export async function processCsvFile(
  path: string,
  pid: any,
  emitter: Emitter,
  updateTracker: (f: Partial<IFileProcess>) => Promise<void>,
  total: number
) {
  let processed = 0;
  let errors: { row: number; message: string }[] = [];

  const reportProgress = (final = false) => {
    const percent = final ? 100 : Math.round((processed / total) * 100);
    emitter.to(pid.toString()).emit("progress", {
      processId: pid.toString(),
      percent,
      processed,
      total,
    });
  };

  const stream = fs.createReadStream(path).pipe(csv());
  let rowNum = 0;
  let buffer: Array<Partial<IStore>> = [];

  for await (const row of stream) {
    rowNum++;
    buffer.push({ ...row, fileProcess: pid });

    if (buffer.length >= BATCH_SIZE) {
      const startRow = rowNum - buffer.length + 1;

      const stats = await processBatch(buffer.splice(0), startRow);
      processed += stats.inserted + stats.failed;
      errors.push(...stats.errors);

      // Emit live log for this batch
      emitter.to(pid.toString()).emit("log", {
        processId: pid.toString(),
        message: `🔄 Batch starting @${startRow} — ✅ Inserted: ${stats.inserted}, ❌ Failed: ${stats.failed}`,
        processed,
        failed: errors.length,
      });

      // Emit batch complete with detail
      emitter.to(pid.toString()).emit("batch-complete", {
        batchStart: startRow,
        batchEnd: startRow + BATCH_SIZE - 1,
        inserted: stats.inserted,
        failed: stats.failed,
        totalProcessed: processed,
        totalFailed: errors.length,
        totalSuccess: processed - errors.length,
      });

      // Update tracker in DB
      await updateTracker({
        processed,
        success: processed - errors.length,
        failed: errors.length,
      });

      reportProgress();
    }
  }

  // Final flush for remaining buffer
  if (buffer.length) {
    const startRow = rowNum - buffer.length + 1;

    const stats = await processBatch(buffer, startRow);
    processed += stats.inserted + stats.failed;
    errors.push(...stats.errors);

    emitter.to(pid.toString()).emit("log", {
      processId: pid.toString(),
      message: `🧹 Final Batch @${startRow} — ✅ Inserted: ${stats.inserted}, ❌ Failed: ${stats.failed}`,
      processed,
    });

    emitter.to(pid.toString()).emit("batch-complete", {
      batchStart: startRow,
      batchEnd: rowNum,
      inserted: stats.inserted,
      failed: stats.failed,
      totalProcessed: processed,
      totalFailed: errors.length,
      totalSuccess: processed - errors.length,
    });

    await updateTracker({
      processed,
      success: processed - errors.length,
      failed: errors.length,
    });

    reportProgress(true);
  }

  emitter.to(pid.toString()).emit("log", {
    processId: pid.toString(),
    message: "🎉 File processing completed",
  });

  await fs.promises.unlink(path);
  emitter.to(pid.toString()).emit("log", {
    processId: pid.toString(),
    message: "🗑️ Temporary file deleted",
  });

  const summary = {
    processId: pid.toString(),
    total,
    success: total - errors.length,
    failed: errors.length,
    errors,
  };

  emitter.to(pid.toString()).emit("summary", summary);

  await updateTracker({
    processed: total,
    success: summary.success,
    failed: summary.failed,
    processingErrors: summary.errors,
    status: "completed",
  });

  return summary;
}

export function countRows(path: string): Promise<number> {
  return new Promise((res, rej) => {
    let cnt = 0;
    fs.createReadStream(path)
      .pipe(csv())
      .on("data", () => cnt++)
      .on("end", () => res(cnt))
      .on("error", rej);
  });
}
