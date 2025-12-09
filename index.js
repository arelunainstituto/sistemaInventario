// Entrypoint principal para o Vercel
// Este arquivo redireciona para a função serverless em api/index.js

const app = require('./api/index.js');

module.exports = app;