const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const upload = multer({ storage: multer.memoryStorage() });

exports.handler = async (event, context) => {
    console.log('Received event:', JSON.stringify(event));

    if (event.httpMethod !== 'POST') {
        console.log('Invalid HTTP method');
        return {
            statusCode: 405,
            body: 'Method Not Allowed'
        };
    }

    try {
        const form = new formidable.IncomingForm();
        form.parse(event, async (err, fields, files) => {
            if (err) {
                console.log('Error parsing the files:', err);
                return {
                    statusCode: 500,
                    body: 'Error parsing the files'
                };
            }

            console.log('Files received:', files);

            const outputFilenames = await Promise.all(Object.values(files).map(async (file) => {
                const outputFilename = `${file.originalname.split('.')[0]}-resized.jpeg`;
                const outputFilePath = path.resolve('/tmp', outputFilename);

                console.log('Processing file:', file.path);
                await sharp(file.path)
                    .resize(1984, 1100)
                    .jpeg({ quality: 90 })
                    .toFile(outputFilePath);

                console.log('Processed file saved to:', outputFilePath);
                return outputFilePath;
            }));

            console.log('All files processed. Creating ZIP archive.');

            const zipFileName = `converted-images-${Date.now()}.zip`;
            const zipFilePath = path.resolve('/tmp', zipFileName);
            const output = fs.createWriteStream(zipFilePath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                fs.readFile(zipFilePath, (err, data) => {
                    if (err) {
                        console.log('Error reading the ZIP file:', err);
                        return {
                            statusCode: 500,
                            body: 'Error creating the ZIP file'
                        };
                    }
                    return {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/zip',
                            'Content-Disposition': `attachment; filename=${zipFileName}`
                        },
                        body: data.toString('base64'),
                        isBase64Encoded: true
                    };
                });
            });

            archive.on('error', (err) => {
                console.log('Error creating the archive:', err);
                throw err;
            });

            archive.pipe(output);
            outputFilenames.forEach((filePath) => {
                archive.file(filePath, { name: path.basename(filePath) });
            });
            await archive.finalize();

            console.log('ZIP archive created successfully.');
        });
    } catch (error) {
        console.log('Error processing the images:', error);
        return {
            statusCode: 500,
            body: 'Error processing the images'
        };
    }
};
