
all: watch

clean:
	rm -rf test/output

test-cmd: clean
	hcp test/examples/* test/output/ -d

babel:
	babel lib/ -d src/

test: babel
	mocha -R spec

eslint:
	echo $PATH
	DEBUG="eslint:cli-engine" eslint .

watch:
	watchd *.* lib/* bin/* test/* -c 'bake test'

release: version push publish

version:
	standard-version -m '%s'

push:
	git push origin master --tags

publish:
	npm publish
