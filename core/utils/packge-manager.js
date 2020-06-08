const fs = require('fs-extra')
const path = require('path')

const minimist = require('minimist')
const LRU = require('lru-cache')


const { hasYarn, hasProjectYarn } = require('../../utils/env')
const { log, warn } = require('../../utils/logger')
const { executeCommand } = require('./execute-command')


const metadataCache = new LRU({
  max: 200,
  maxAge: 1000 * 60 * 30 // 30 min.
})

const SUPPORTED_PACKAGE_MANAGERS = ['yarn', 'npm']
const PACKAGE_MANAGER_CONFIG = {
  npm: {
    install: ['install', '--loglevel', 'error'],
    add: ['install', '--loglevel', 'error'],
    upgrade: ['update', '--loglevel', 'error'],
    remove: ['uninstall', '--loglevel', 'error']
  },
  yarn: {
    install: [],
    add: ['add'],
    upgrade: ['upgrade'],
    remove: ['remove']
  }
}

class PackageManager {
  constructor({ context, forcePackageManager } = {}) {
    this.context = context || process.cwd()

    if (forcePackageManager) {
      this.bin = forcePackageManager
    } else if (context && hasProjectYarn()) {
      this.bin = 'yarn'
    }

    // if no package managers specified, and no lockfile exists
    if (!this.bin) {
      this.bin = loadOptions().packageManager || (hasYarn() ? 'yarn' : 'npm')
    }

    if (!SUPPORTED_PACKAGE_MANAGERS.includes(this.bin)) {
      log()
      warn(
        `The package manager ${chalk.red(this.bin)} is ${chalk.red('not officially supported')}.\n` +
        `It will be treated like ${chalk.cyan('npm')}, but compatibility issues may occur.\n` +
        `See if you can use ${chalk.cyan('--registry')} instead.`
      )
      PACKAGE_MANAGER_CONFIG[this.bin] = PACKAGE_MANAGER_CONFIG.npm
    }

  }

  async runCommand (command, args) {
    await this.setRegistryEnvs()
    return await executeCommand(
      this.bin,
      [
        ...PACKAGE_MANAGER_CONFIG[this.bin][command],
        ...(args || [])
      ],
      this.context
    )
  }

  async install () {
    return await this.runCommand('install')
  }

  async add(packageName, { tilde = false, dev = true } = {}) {
    const args = dev ? ['-D'] : []
    if (tilde) {
      if (this.bin === 'yarn') {
        args.push('--tilde')
      } else {
        process.env.npm_config_save_prefix = '~'
      }
    }
    return await this.runCommand('add', [packageName, ...args])
  }
}


module.exports = PackageManager
