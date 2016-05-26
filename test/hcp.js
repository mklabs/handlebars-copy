
const fs       = require('fs');
const path     = require('path');
const test     = require('gentle-cli');
const { join } = require('path');
const assert   = require('assert');

describe('hcp', () => {
  let hcp = (cmd) => {
    let binpath = join(__dirname, '../bin/hcp');
    return test().use(`node ${binpath} ${cmd}`);
  };

  describe('cli', () => {
    it('hcp test/examples/* test/output/', (done) => {
      hcp('test/examples/* test/output.json')
        .expect(0, (err) => {
          if (err) return done(err);

          assert.deepEqual(require('./output.json'), {
            name: 'input',
            description: '',
            foo: 'bar'
          });

          done();
        });
    });

    it('hcp test/examples/* test/existing.json', (done) => {
      hcp('test/examples/* test/existing.json')
        .expect(0, (err) => {
          if (err) return done(err);

          assert.deepEqual(require('./existing.json'), {
            name: 'output',
            description: '...',
            foo: 'bar',
            bar: true
          });

          fs.writeFile(path.join(__dirname, 'existing.json'), JSON.stringify({
            name: 'output',
            description: '...',
            bar: true
          }, null, 2), done);
        });
    });
  });
});
