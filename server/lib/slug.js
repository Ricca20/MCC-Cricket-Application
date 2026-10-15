const crypto = require('crypto');

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

// nanoid-style URL-safe id: 8 chars from 36 symbols ≈ 2.8e12 combinations
const randomId = (length = 8) => {
  let id = '';
  for (let i = 0; i < length; i++) id += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return id;
};

// Creates a document with a unique publicSlug, retrying on the rare collision
const createWithSlug = async (Model, prefix, data, options) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [doc] = await Model.create([{ ...data, publicSlug: `${prefix}-${randomId()}` }], options);
      return doc;
    } catch (error) {
      if (error.code !== 11000 || !error.keyPattern?.publicSlug) throw error;
    }
  }
  throw new Error('Could not generate a unique slug');
};

// Unbiased Fisher-Yates shuffle using a CSPRNG
const shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

module.exports = { randomId, createWithSlug, shuffle };
