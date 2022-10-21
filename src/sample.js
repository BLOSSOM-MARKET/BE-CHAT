const sampleSchema = require('../models/sample');

exports.addSample = async (sample) => {
    if (typeof sample === 'undefined' || sample === {}) {
        throw new TypeError(`sample(${sample}) is empty`);
    }
    
    const samples = await sampleSchema.addSample(sample);
    
    return samples;
}