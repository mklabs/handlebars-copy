
const fs       = require('fs');
const path     = require('path');
const cli      = require('gentle-cli');
const { join } = require('path');
const assert   = require('assert');

describe('hcp', () => {
  let hcp = (cmd) => {
    let binpath = join(__dirname, '../bin/hcp');
    return cli().use(`node ${binpath} ${cmd}`);
  };

  let test = (cmd, next) => {
    it(`hcp ${cmd}`, (done) => {
      hcp(cmd)
        .expect('foo')
        .expect(0, () => {
          next();
          done();
        });
    });
  };

  describe('cli', () => {
    test('test/examples/package.json test/output.json', () => {
      assert.deepEqual(require('./output.json'), {
        name: 'input',
        description: '',
        foo: 'bar'
      });
    });

    it('hcp test/examples/package.json test/existing.json', (done) => {
      hcp('test/examples/package.json test/existing.json')
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
