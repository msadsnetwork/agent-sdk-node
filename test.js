const assert = require('assert'); const { sign, AgentExchange } = require('./index');
const fs = require('fs'); const v = require(fs.existsSync(__dirname + '/test_vectors.json') ? './test_vectors.json' : '../test_vectors.json');
for (const t of v.vectors) assert.strictEqual(sign(t.secret, t.timestamp, t.nonce, t.method, t.path, t.body), t.signature);
assert.strictEqual(AgentExchange.proofHash('ORDER-1').length, 64);
console.log(`node sdk: ${v.vectors.length} signature vectors OK`);
