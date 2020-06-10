#!/usr/bin/env node

const { semver, error, checkNodeVersion } = require('../shared-utils')
const packageJson = require('../package.json')
const requiredVersion = packageJson.engines.node

checkNodeVersion(requiredVersion, 'ZN-SERVICE')

const Service = require('../service/Service')
const service = new Service(process.env.VUE_CLI_CONTEXT || process.cwd())
