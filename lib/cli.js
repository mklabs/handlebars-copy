const fs       = require('fs');
const path     = require('path');
const { CLI }  = require('roar');
const glob     = require('glob');
const mkdirp   = require('mkdirp');
const assign   = require('deep-assign');
const through2 = require('through2');
var template   = require('lodash.template');

const exists = fs.existsSync;

// node(resolve, reject)
const node = (resolve, reject) => (err) => { err ? reject(err) : resolve(); };

export default class Command extends CLI {
  get example () {
    return 'hcp <files...> [options]';
  }

  get more () {
    return `
  Examples:

    $ hcp package.json package.copy.json
    $ hcp index.html package.json app/ --name foobar
    $ hcp_name="foobar" hcp text/examples/* ~/dev/myapp/app
`;
  }

  get messages () {
    return {
      NOT_A_DIRECTORY: 'target \'%s\' is not a directory',
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
      debug: 'Show extended debug output'
    };
  }

  get templateSettings () {
    return {
      interpolate: /{{(.+?)}}/g
    };
  }

  get inquirer () {
    try {
      return require('inquirer').createPromptModule();
    } catch (e) {
      this.error('Inquirer is not available, skipping prompt');
    }
  }

  get globSettings () {
    return {
      dot: true,
      nodir: true,
      matchBase: true
    };
  }

  get arrow () {
    return '=>';
  }

  constructor (parser, options) {
    super(parser, options);

    if (this.argv.help) this.help().exit();
    if (this.argv.version) this.info(require('../package.json').version).exit();

    this.env = Object.keys(this.env)
      .filter(name => /^hcp_/i.test(name))
      .map(name => { return { name, value: this.env[name] }; })
      .reduce((a, b) => {
        a[b.name.replace(/^hcp_/i, '')] = b.value;
        return a;
      }, {});

    process.nextTick(this.init.bind(this));
  }

  init () {
    this.files = this.argv._.concat();
    this.dest = this.files.pop();
    this.dir = this.dest && this.dest.slice(-1)[0] === '/';

    this.check();

    this.files = this.files.map(this.globSync).reduce(this.flatten, []);
    this.debug('hcp %s files to %s destination', this.files, this.dest);

    Promise.all(this.files.map(file => this.write(file, this.dest)))
      // .then(res => this.success('Done'))
      .catch(CLI.fail);
  }

  write (file, dest) {
    var promise = this.dir ? this.mkdirp(this.dest) : this.noop();
    return promise.then(this.copy.bind(this, file));
  }

  copy (file) {
    var dest = this.dir ? path.join(this.dest, path.basename(file)) : this.dest;
    return this.exists(dest)
      .then((filepath) => {
        let ext = path.extname(file);

        this.debug('stream copy %s to %s', file, dest, ext, filepath);

        if (filepath && ext === '.json') return this.json(file, dest);

        // todo: interactive mode, prompt for overwrite, possibliy see conflict
        if (filepath) return this.noop();

        return this.file(file, dest);
      });
  }

  file (file, dest) {
    this.debug('file', file, dest);
    this.isDirectory(file)
      .then((dir) => {
        this.debug('input %s is dir', file, dir);

        if (dir) return this.dirCopy(file, dest);
        return this.mkdirp(path.dirname(dest))
          .then(() => this.fileCopy(file, dest));
      });
  }

  dirCopy (from, to) {
    return this.glob(path.join(from, '**'))
      .then((files) => {
        this.files = this.files.concat(files);
        this.info('Directory copy %s to %s', from, this.dest);
        var promises = files.map(file => this.fileCopy(file, path.join(this.dest, file)));
        return Promise.all(promises);
      });
  }

  fileCopy (file, dest) {
    let max = Math.max.apply(Math, this.files.map(file => file.length));
    this.success('%s%s%s %s', file, this.pad(file, max + 2), this.arrow, dest);

    file = path.resolve(file);
    return new Promise((r, errback) => {
      let input = fs.createReadStream(file);
      let out = fs.createWriteStream(dest);
      let chunks = '';

      input.setEncoding('utf8');
      input.on('data', chunk => { chunks += chunk; });

      input
        .pipe(this.transform(file, dest))
        .pipe(out)
        .on('error', errback)
        .on('close', r);
    });
  }

  transform () {
    let render = this.render.bind(this);
    return through2(function (chunk, enc, done) {
      render(chunk + '', (err, res) => {
        if (err) return done(err);
        this.push(res);
        return done();
      });
    });
  }

  placeholders (content = '') {
    let placeholders = content.match(/{{([^}]+}})/g);
    if (!placeholders) return;

    placeholders = placeholders.map((p) => {
      return p.replace(/{{\s*/, '').replace(/\s*}}/, '');
    });

    placeholders = placeholders.reduce(this.uniq.bind(this), []);

    // skip values already available in env or options
    placeholders = placeholders.filter((name) => {
      return !(name in this.argv || name in this.env);
    });

    return placeholders;
  }

  question (name, message) {
    return {
      type: 'input',
      message: name || message,
      default: this.argv[name] || this.end[name] || name,
      name
    };
  }

  render (content, done) {
    let placeholders = this.placeholders(content);
    if (!placeholders) return this.template(content, {}, done);

    let questions = placeholders.map(this.question, this);

    this.prompt(questions).catch(done).then((answers) => {
      let argv = Object.assign({}, this.argv);
      delete argv._;

      var data = Object.assign({}, this.env, argv);

      placeholders.forEach((p) => {
        let answer = answers[p] === 'true' ? true
          : answers[p] === 'false' ? false
          : answers[p];

        data[p] = typeof answer !== 'undefined' ? answer : (this.argv[p] || p);
      });

      this.debug('data', data);
      this.template(content, data, done);
    });
  }

  prompt (questions, done) {
    let inquirer = this.inquirer;
    return inquirer ? inquirer(questions, done) : done();
  }

  template (content, data, done) {
    var tpl = template(content, this.templateSettings);
    let output = tpl(data);
    done(null, output);
  }

  json (file, destination) {
    this.debug('json', file, dest);
    let input = this.readJSON(path.resolve(file));
    let dest = path.resolve(destination);
    dest = exists(dest) ? this.readJSON(dest) : {};

    let output = assign({}, input, dest);

    this.debug('input', input);
    this.debug('dest', dest);
    this.debug('output', output);

    return new Promise((r, errback) => {
      fs.writeFile(destination, JSON.stringify(output, null, 2), node(r, errback));
    });
  }

  readJSON (file) {
    try {
      return require(file);
    } catch (e) {
      this.warn(e.message);
      return {};
    }
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

  globSync (pattern, opts = this.globSettings) {
    return glob.sync(pattern, opts);
  }

  glob (pattern, opts = this.globSettings) {
    return new Promise((r, errback) => {
      this.debug('glob', pattern, opts);
      glob(pattern, opts, (err, files) => {
        err ? errback(err) : r(files);
      });
    });
  }

  flatten (a, b) {
    return a.concat(b);
  }

  uniq (a, b) {
    if (a.indexOf(b) !== -1) return a;
    return a.concat(b);
  }

  check () {
    if (!this.files.length) {
      if (this.dest) this.error(this.messages.MISSING_DESTINATION_FILE_OPERAND, this.dest);
      else this.error(this.messages.MISSING_FILE_OPERAND);
      this.exit(1);
    }

    if (this.files.length > 1 && this.dest) {
      if (!this.dir) this.error(this.messages.NOT_A_DIRECTORY, this.dest).exit(1);
    }
  }
}
