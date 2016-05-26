
all: watch

clean:
	rm -rf test/output.json test/output

test-cmd: clean babel
	hcp test/examples/tpl.hbs test/output/ --name foo --description foo -d
	cat test/output/tpl.hbs

babel:
	babel lib/ -d src/

test: babel eslint clean
	mocha -R spec

eslint:
	DEBUG="eslint:cli-engine" eslint .

watch:
	watchd *.* lib/* bin/* test/hcp.js -c 'bake test'

version:
	standard-version -m '%s'

push: test
	git push origin master --tags

publish: push
	npm publish

docs:
	mocha -R markdown >> readme.md

release: version publish
