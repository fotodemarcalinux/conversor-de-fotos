const busboy = require('busboy');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

exports.handler = async (event) => {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: event.headers });
    const files = [];
    const uploadsDir = '/tmp';

    bb.on('file', (name, file, info) => {
      const { filename } = info;
      const filePath = path.join(uploadsDir, filename);
      const writeStream = fs.createWriteStream(filePath);

      file.pipe(writeStream);
      writeStream.on('close', () => {
        files.push(filePath);
      });
    });

    bb.on('close', async () => {
      try {
        const outputFilenames = await Promise.all(files.map(async (filePath) => {
          const outputFilename = `${path.parse(filePath).name}-resized.jpeg`;
          const outputFilePath = path.join(uploadsDir, outputFilename);

          await sharp(filePath)
            .resize(1984, 1100)
            .jpeg({ quality: 90 })
            .toFile(outputFilePath);

          return outputFilePath;
        }));

        const zipFileName = `converted-images-${Date.now()}.zip`;
        const zipFilePath = path.join(uploadsDir, zipFileName);
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', async () => {
          const data = await fs.promises.readFile(zipFilePath);
          resolve({
            statusCode: 200,
            headers: {
              'Content-Type': 'application/zip',
              'Content-Disposition': `attachment; filename=${zipFileName}`,
            },
            body: data.toString('base64'),
            isBase64Encoded: true,
          });
        });

        archive.on('error', (err) => {
          reject({
            statusCode: 500,
            body: `Error creating archive: ${err.message}`,
          });
        });

        archive.pipe(output);
        outputFilenames.forEach((filePath) => {
          archive.file(filePath, { name: path.basename(filePath) });
        });
        await archive.finalize();
      } catch (error) {
        reject({
          statusCode: 500,
          body: `Error processing images: ${error.message}`,
        });
      }
    });

    bb.on('error', (err) => {
      reject({
        statusCode: 500,
        body: `Error processing form: ${err.message}`,
      });
    });

    bb.end(Buffer.from(event.body, 'base64'));
  });
};
