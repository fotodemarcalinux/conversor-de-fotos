const busboy = require('busboy');
const { Handler } = require('@netlify/functions');

const handler = async (event) => {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: event.headers });
    const fields = {};
    const files = [];

    bb.on('file', (name, file, info) => {
      const { filename, encoding, mimeType } = info;
      let fileData = [];

      file.on('data', (data) => {
        fileData.push(data);
      });

      file.on('end', () => {
        files.push({
          fieldname: name,
          originalname: filename,
          encoding: encoding,
          mimetype: mimeType,
          buffer: Buffer.concat(fileData),
        });
      });
    });

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('close', () => {
      // Aqui você pode processar os arquivos e campos conforme necessário
      console.log('Upload terminado:', { fields, files });
      resolve({
        statusCode: 200,
        body: JSON.stringify({ message: 'Upload bem-sucedido!', fields, files }),
      });
    });

    bb.on('error', (err) => {
      reject({
        statusCode: 500,
        body: JSON.stringify({ error: err.message }),
      });
    });

    bb.end(Buffer.from(event.body, 'base64'));
  });
};

module.exports = { handler };
