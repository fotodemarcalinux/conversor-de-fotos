const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

app.post('/upload', upload.array('images', 10), async (req, res) => {
    const promises = req.files.map(async (file) => {
        const { filename } = file;
        const outputFilename = `${filename}.jpeg`;
        const outputFilePath = path.resolve(file.destination, 'resized', outputFilename);
        try {
            await sharp(file.path)
                .resize(1984, 1100)
                .jpeg({ quality: 90 })
                .toFile(outputFilePath);
            fs.unlink(file.path, (err) => {
                if (err) {
                    console.error('Falha ao excluir o arquivo:', err);
                }
            });
            return outputFilename;
        } catch (error) {
            console.error('Erro ao processar a imagem:', error);
        }
    });

    try {
        const outputFilenames = await Promise.all(promises);
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
            throw err;
        });

        archive.pipe(output);
        outputFilenames.forEach((filename) => {
            const filePath = path.resolve('uploads/resized', filename);
            archive.file(filePath, { name: filename });
        });
        await archive.finalize();
    } catch (error) {
        res.status(500).send('Erro ao processar as imagens.');
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
