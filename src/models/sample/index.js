const schema = require('./schema');

exports.addSample = async (sample) => {
    const ret = await schema.create({...sample});
    
    return ret || {};
}