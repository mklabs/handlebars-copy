
const test     = require('gentle-cli');
const { join } = require('path');

describe('hcp', () => {
  let hcp = (cmd) => {
    let binpath = join(__dirname, '../bin/hcp');
    return test().use(`node ${binpath} ${cmd}`);
  };

  describe('cli', () => {
    it('hcp test/examples/* test/output/', (done) => {
      hcp('test/examples/* test/output')
        .expect(0, done);
    });
  });
});
