const tc   = require('template-copy');
const roar = require('roar');

export default class Command extends roar.CLI {
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

  constructor (parser, options) {
    super(parser, options);

    if (this.argv.help) this.help().exit();
    if (this.argv.version) this.info(require('../package.json').version).exit();

    this.tc = tc(this.argv._.join(' '), this.argv);

    process.nextTick(this.init.bind(this));
  }

  init () {
    let files = this.argv._.concat();
    return this.tc.init(files)
      .then(res => this.success('Done'));
  }
}
