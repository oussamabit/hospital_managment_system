/**
 * fix-dicom-previews.ts
 * One-time script: reads all DICOM series that have a previews/ folder on disk
 * but no previews[] in the Mongoose schema, then saves them properly.
 *
 * Run with:
 *   cd backend
 *   npx ts-node src/scripts/fix-dicom-previews.ts
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import connectDB from '../config/db';
import Hospitalization from '../models/Hospitalization';

const run = async () => {
  await connectDB();
  console.log('Connected to MongoDB');

  const hosps = await Hospitalization.find({ 'bilanMorphologique.series.0': { $exists: true } });
  console.log(`Found ${hosps.length} hospitalization(s) with DICOM series`);

  let fixed = 0;

  for (const hosp of hosps) {
    const series = (hosp.bilanMorphologique?.series || []) as any[];

    for (const s of series) {
      // Skip if previews already populated
      if (s.previews && s.previews.length > 0) {
        console.log(`  [OK]   ${s.seriesId} — already has ${s.previews.length} previews`);
        continue;
      }

      const previewDir = path.join(s.folderPath, 'previews');
      if (!fs.existsSync(previewDir)) {
        console.log(`  [SKIP] ${s.seriesId} — no previews/ folder on disk`);
        continue;
      }

      const jpgFiles = fs.readdirSync(previewDir)
        .filter(f => /\.(jpe?g)$/i.test(f))
        .sort();

      if (!jpgFiles.length) {
        console.log(`  [SKIP] ${s.seriesId} — previews/ folder is empty`);
        continue;
      }

      const previewEntries = jpgFiles.map(fname => ({
        fileId:       uuidv4(),
        filePath:     path.join(previewDir, fname).replace(/\\/g, '/'),
        originalName: fname,
        fileType:     'image/jpeg',
        uploadedAt:   new Date(),
        notes:        'DICOM preview',
      }));

      await Hospitalization.findOneAndUpdate(
        { _id: hosp._id, 'bilanMorphologique.series.seriesId': s.seriesId },
        { $set: { 'bilanMorphologique.series.$.previews': previewEntries } },
        { new: true }
      );

      console.log(`  [FIXED] ${s.seriesId} — saved ${previewEntries.length} previews`);
      fixed++;
    }
  }

  console.log(`\nDone. Fixed ${fixed} series.`);
  process.exit(0);
};

run().catch(err => { console.error(err); process.exit(1); });
