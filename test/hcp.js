
const fs       = require('fs');
const path     = require('path');
const cli      = require('gentle-cli');
const { join } = require('path');
const assert   = require('assert');

let hcp = (cmd) => {
  let binpath = join(__dirname, '../bin/hcp');
  return cli().use(`node ${binpath} ${cmd}`);
};

describe('hcp', () => {
  describe('cli', () => {
    describe('Copy files', () => {
      it('hcp test/examples/package.json test/output.json', (done) => {
        hcp('test/examples/package.json test/output.json')
          .expect(0)
          .end(() => {
            assert.deepEqual(require('./output.json'), {
              name: 'input',
              description: '',
              foo: 'bar'
            });

            done();
          });
      });
    });

    describe('Merges files with existing JSON destination', () => {
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

    describe('Transfrom Handlebars / Mustache like placeholders with lodash.template', () => {
      it('hcp test/examples/* test/output/ --name blah --description desc --foo bar', (done) => {
        hcp('test/examples/* test/output/ --name blah --description desc --foo bar')
          .expect(0, (err) => {
            if (err) return done(err);

            assert.deepEqual(require('./output/package.json'), {
              name: 'input',
              description: '',
              foo: 'bar'
            });

            assert.deepEqual(require('./output/tpl.json'), {
              name: 'blah',
              description: 'desc',
              foo: 'bar'
            });

            done();
          });
      });
    });
  });
});
