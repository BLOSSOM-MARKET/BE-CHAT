const mongoose = require('mongoose');

const { Schema } = mongoose;

const sampleSchema = new Schema({
  userId: { type: String, required: true },
  text: { type: String },
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false });

module.exports = mongoose.model('sample', sampleSchema);