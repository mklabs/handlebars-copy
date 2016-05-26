## hcp [![Build Status](https://travis-ci.org/mklabs/handlebars-copy.svg?branch=master)](https://travis-ci.org/mklabs/handlebars-copy)

> hcp - handlebars-copy
>
> Like cp, but with Handlebars template

## Install

    npm install hcp

## Usage

```
  $ hcp <files...> [options]

  Options:
    --help             Show this help output
    --version          Show package version
    --debug            Show extended debug output

  Examples:

    $ hcp package.json package.copy.json
    $ hcp index.html package.json app/ --name foobar
    $ hcp_name="foobar" hcp text/examples/* ~/dev/myapp/app
```

## Description

hcp is a CLI tool similar to the `cp` command.

File copy is done using Streams, with `lodash.template` parsing files if they
have template placeholders `{{ ... }}`.

Handlebars template are executed in the context of the following object:

```js
Object.assign({}, env, opts)

// where `env` and `opts` have the following structure

{
  env: {
    PATH: '...',
    ...
  },

  opts: {
    debug: true,
    name: 'Foobar'
  }
}
```

The templates context is a merged version of various sources, with the
following order of precedence:

- opts    - Command line flags as parsed by minimist
- env     - `process.env` variables begining with `hcp_`
- prompts - Generated prompts, see below

## Prompts

Handlebars templates can have any number of placeholders. Variables are either
available in the context object, or automatically prompted for the user to
enter a value.

Skipping a prompt is then available with `--name Value`.

To enable it, inquirer must be installed and available in `node_modules`.

    npm i inquirer -D

If not installed, prompts are not generated.

## JSON

JSON files are merged together with destination, if it already exists.

## Tests / API

- [hcp](#hcp)
 - [cli](#hcp-cli)
   - [Copy files](#hcp-cli-copy-files)
   - [Merges files with existing JSON destination](#hcp-cli-merges-files-with-existing-json-destination)
   - [Transfrom Handlebars / Mustache like placeholders with lodash.template](#hcp-cli-transfrom-handlebars--mustache-like-placeholders-with-lodashtemplate)

### hcp
<a name="hcp-cli"></a>
#### cli
<a name="hcp-cli-copy-files"></a>
##### Copy files
hcp test/examples/package.json test/output.json.

```js
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
```

<a name="hcp-cli-merges-files-with-existing-json-destination"></a>
##### Merges files with existing JSON destination
hcp test/examples/package.json test/existing.json.

```js
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
```

<a name="hcp-cli-transfrom-handlebars--mustache-like-placeholders-with-lodashtemplate"></a>
##### Transfrom Handlebars / Mustache like placeholders with lodash.template
hcp test/examples/* test/output/ --name blah --description desc --foo bar.

```js
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
```

