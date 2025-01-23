import express from 'express';
import { isAuth } from './middleware/auth.js';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import { deleteOldImage } from './util/file.js';
import path from 'node:path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import { graphqlHTTP } from 'express-graphql';
import graphQlSchema from './graphQL/schema.js';
import graphQlResolvers from './graphQL/resolvers.js';
import pkg from 'graphql';
const { customFormatErrorFn } = pkg;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI;

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, new Date().toISOString() + '-' + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.use(bodyParser.json());
app.use(multer({ storage: fileStorage, fileFilter }).single('image'));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,GET,POST,PUT,PATCH,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(isAuth);

app.put('/post-image', (req, res, next) => {
  if (!req.isAuth) {
    throw new Error('Not Authenticated');
  }
  if (!req.file) {
    return res.status(200).json({ message: 'No file provided' });
  }
  if (req.body.oldPath) {
    deleteOldImage(req.body.oldPath);
  }
  return res.status(201).json({ message: 'File stored', filePath: req.file.path });
});

app.use(
  '/graphql',
  graphqlHTTP({
    schema: graphQlSchema,
    rootValue: graphQlResolvers,
    graphiql: true,
    customFormatErrorFn(err) {
      console.log('ERROR HANDLER IN APP.JS');
      if (!err.originalError) {
        return err;
      }
      const data = err.originalError;
      const message = err.message || 'An error occurred';
      const status = err.originalError.code || 500;
      console.log(message);
      return { message, status, data };
    },
  }),
);

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json(message, data);
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(process.env.SERVER_PORT);
  })
  .catch((err) => console.log(err));

