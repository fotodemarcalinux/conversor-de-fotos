const Busboy = require('busboy');
const sharp = require('sharp');
const { createWriteStream, readFileSync } = require('fs');
const { join } = require('path');
const archiver = require('archiver');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed',
        };
    }

    return new Promise((resolve, reject) => {
        const busboy = new Busboy({ headers: event.headers });
        const files = [];

        busboy.on('file', (fieldname, file, filename) => {
            const buffer = [];
            file.on('data', (data) => buffer.push(data));
            file.on('end', async () => {
                try {
                    const fileBuffer = Buffer.concat(buffer);
                    const outputFilename = `${filename.split('.')[0]}-resized.jpeg`;
                    const outputFilePath = join('/tmp', outputFilename);

                    await sharp(fileBuffer)
                        .resize(1984, 1100)
                        .jpeg({ quality: 90 })
                        .toFile(outputFilePath);

                    files.push(outputFilePath);
                } catch (error) {
                    console.error('Error processing file:', error);
                    reject({
                        statusCode: 500,
                        body: 'Error processing images',
                    });
                }
            });
        });

        busboy.on('finish', async () => {
            if (files.length === 0) {
                resolve({
                    statusCode: 400,
                    body: 'No files uploaded',
                });
                return;
            }

            const zipFileName = `converted-images-${Date.now()}.zip`;
            const zipFilePath = join('/tmp', zipFileName);
            const output = createWriteStream(zipFilePath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                resolve({
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/zip',
                        'Content-Disposition': `attachment; filename="${zipFileName}"`,
                    },
                    body: readFileSync(zipFilePath).toString('base64'),
                    isBase64Encoded: true,
                });
            });

            archive.on('error', (err) => {
                console.error('Error creating ZIP file:', err);
                reject({
                    statusCode: 500,
                    body: 'Error creating ZIP file',
                });
            });

            archive.pipe(output);
            files.forEach((filePath) => {
                archive.file(filePath, { name: filePath.split('/').pop() });
            });
            await archive.finalize();
        });

        busboy.write(event.body, event.isBase64Encoded ? 'base64' : 'binary');
        busboy.end();
    });
};
