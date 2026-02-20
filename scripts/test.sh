#!/bin/bash
NODE_OPTIONS='--no-experimental-strip-types' npx ts-mocha -p ./tsconfig.tests.json -t 1000000 tests/*.ts --recursive
