
const CLI = require('./cli');
const minimist = require('minimist');

const hcp = () => {
  return new CLI(minimist);
};

module.exports = hcp;
hcp.CLI = CLI;
