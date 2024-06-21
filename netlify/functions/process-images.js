const multer = require('multer');
const sharp = require('sharp');
const { createWriteStream, readFileSync } = require('fs');
const { join } = require('path');
const archiver = require('archiver');

const upload = multer({ storage: multer.memoryStorage() });

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed'
        };
    }

    const form = new FormData();
    const files = form.parse(event.body).images;

    if (!files || !files.length) {
        return {
            statusCode: 400,
            body: 'No files uploaded'
        };
    }

    const outputFilenames = [];
    try {
        await Promise.all(files.map(async (file) => {
            const outputFilename = `${file.originalname.split('.')[0]}-resized.jpeg`;
            const outputFilePath = join('/tmp', outputFilename);

            await sharp(file.buffer)
                .resize(1984, 1100)
                .jpeg({ quality: 90 })
                .toFile(outputFilePath);

            outputFilenames.push(outputFilePath);
        }));

        const zipFileName = `converted-images-${Date.now()}.zip`;
        const zipFilePath = join('/tmp', zipFileName);
        const output = createWriteStream(zipFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.pipe(output);
        outputFilenames.forEach(filePath => {
            archive.file(filePath, { name: filePath.split('/').pop() });
        });
        await archive.finalize();

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${zipFileName}"`
            },
            body: readFileSync(zipFilePath).toString('base64'),
            isBase64Encoded: true
        };
    } catch (error) {
        console.error('Error processing images:', error);
        return {
            statusCode: 500,
            body: 'Error processing images'
        };
    }
};
