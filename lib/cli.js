const fs      = require('fs');
const path    = require('path');
const { CLI } = require('roar');
const glob    = require('glob');
const mkdirp  = require('mkdirp');
const assign  = require('deep-assign');

// node(resolve, reject)
const node = (resolve, reject) => (err) => { err ? reject(err) : resolve(); };

export default class Command extends CLI {
  get example () {
    return 'hcp <files...> [options]';
  }

  get more () {
    return `
  Examples:

    $ hcp *.js app/
`;
  }

  get messages () {
    return {
      MISSING_FILE_OPERAND: 'missing file operand',
      MISSING_DESTINATION_FILE_OPERAND: 'missing destination file operand after \'%s\''
    };
  }

  get alias () {
    return {
      h: 'help',
      v: 'verbose',
      d: 'debug',
      r: 'recursive',
      f: 'force'
    };
  }

  get flags () {
    return {
      help: 'Show this help output',
      version: 'Show package version',
      debug: 'Show extended debug output',
      verbose: 'Enable extended log output',
      force: 'Force file write even if already existing',
      recursive: 'copy directories recursively'
    };
  }

  constructor (parser, options) {
    super(parser, options);

    if (this.argv.help) this.help().exit();
    if (this.argv.version) this.info(require('../package.json').version).exit();
    process.nextTick(this.init.bind(this));
  }

  init () {
    this.files = this.argv._.concat();
    this.dest = this.files.pop();

    this.check();

    this.dir = this.dest.slice(-1)[0] === '/';

    this.files = this.files.map(this.glob).reduce(this.flatten, []);
    this.info('hcp %s files to %s destination', this.files, this.dest);

    Promise.all(this.files.map(file => this.write(file, this.dest)))
      .then(res => this.success('Done'))
      .catch(CLI.fail);
  }

  write (file, dest) {
    this.info('%s -> %s', file, dest);
    file = path.resolve(file);

    var promise = this.dir ? this.mkdirp(this.dest) : this.noop();
    return promise
      .then(this.copy.bind(this, file))
      .then(res => this.info('End %s', res || ''));
  }

  copy (file) {
    var dest = this.dir ? path.join(this.dest, path.basename(file)) : this.dest;
    this.debug('copy %s -> %s', file, dest, this.dir);

    return this.streamCopy(file, dest);
  }

  streamCopy (file, dest) {
    return this.exists(dest).then((filepath) => {
      var ext = path.extname(file);

      this.debug('stream copy %s to %s', file, dest, ext);

      if (filepath && ext === '.json') return this.json(file, dest);

      // todo: interactive mode, prompt for overwrite, possibliy see conflict
      if (filepath) return this.noop();

      return new Promise((r, errback) => {
        var out = fs.createWriteStream(dest);
        fs.createReadStream(file).pipe(out)
          .on('error', errback)
          .on('close', r);
      });
    });
  }

  json (file, destination) {
    this.debug('json', file, dest);
    var input = require(path.resolve(file));
    var dest = require(path.resolve(destination));

    let output = assign({}, input, dest);

    this.debug('input', input);
    this.debug('dest', dest);
    this.debug('output', output);

    return new Promise((r, errback) => {
      fs.writeFile(destination, JSON.stringify(output, null, 2), node(r, errback));
    });
  }

  noop (...args) {
    return new Promise((r, errback) => r(...args));
  }

  mkdirp (filepath) {
    this.debug('mkdirp %s', filepath);

    return this.isDirectory(filepath)
      .then((isDir) => {
        if (isDir) return filepath;
        return new Promise((r, errback) => {
          mkdirp(path.resolve(filepath), node(r, errback));
        });
      });
  }

  exists (filepath) {
    return new Promise((r, errback) => {
      fs.exists(filepath, (exists) => {
        r(exists ? filepath : false);
      });
    });
  }

  isDirectory (filepath) {
    this.debug('directory check', filepath);
    return new Promise((r, errback) => {
      fs.stat(filepath, (err, stat) => {
        if (err && err.code === 'ENOENT') return r(false);
        err ? errback(err) : r(stat.isDirectory());
      });
    });
  }

  writeStream (file) {
    this.debug('Create %s output stream', file);
    return fs.createReadStream(file);
  }

  readStream (file) {
    this.debug('Create %s input stream', file);
    return fs.createReadStream(file);
  }

  glob (pattern) {
    return glob.sync(pattern);
  }

  flatten (a, b) {
    return a.concat(b);
  }

  check () {
    if (!this.files.length) {
      if (this.dest) this.error(this.messages.MISSING_DESTINATION_FILE_OPERAND, this.dest);
      else this.error(this.messages.MISSING_FILE_OPERAND);
      this.exit(1);
    }
  }
}
