const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static('public'));

app.post('/upload', upload.array('images', 10), async (req, res) => {
    console.log('Arquivos recebidos:', req.files);
    try {
        const outputFilenames = await Promise.all(req.files.map(async (file) => {
            const outputFilename = `${file.originalname.split('.')[0]}-resized.jpeg`;
            const outputFilePath = path.resolve('uploads/resized', outputFilename);

            await sharp(file.buffer)
                .resize(1984, 1100)
                .jpeg({ quality: 90 })
                .toFile(outputFilePath);

            return outputFilename;
        }));

        console.log('Imagens convertidas:', outputFilenames);

        const zipFileName = `converted-images-${Date.now()}.zip`;
        const zipFilePath = path.resolve('uploads', zipFileName);
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            res.download(zipFilePath, (err) => {
                if (err) {
                    console.error('Erro ao enviar o arquivo:', err);
                }
                fs.unlinkSync(zipFilePath); // Excluir o arquivo ZIP após o download
            });
        });

        archive.on('error', (err) => {
            console.error('Erro ao criar o arquivo ZIP:', err);
            throw err;
        });

        archive.pipe(output);
        outputFilenames.forEach((filename) => {
            const filePath = path.resolve('uploads/resized', filename);
            archive.file(filePath, { name: filename });
        });
        await archive.finalize();
    } catch (error) {
        console.error('Erro durante o processamento:', error);
        res.status(500).send('Erro ao processar as imagens.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
