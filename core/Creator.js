const EventEmitter = require('events')
const execa = require('execa')
const inquirer = require('inquirer')
const debug = require('debug')
const path = require('path')
const cloneDeep = require('lodash.clonedeep')

const { clearConsole } = require('../utils/logger')
const { logWithSpinner, stopSpinner } = require('../utils/spinner')
const resolvePkg  = require('../utils/pkg')
const { hasYarn } = require('../utils/env')
const PackageManager = require('./utils/packge-manager')

const writeFileTree = require('./utils/write-file-tree')


const {
  defaults,
  saveOptions,
  loadOptions,
  savePreset,
  validatePreset,
  rcPath
} = require('./options')

const isManualMode = answers => answers.preset === '__manual__'


class Creator extends EventEmitter {
  constructor(name, context, promptModules) {
    super()

    this.name = name
    this.context = process.env.ZN_CLI_CONTEXT = context
    const { presetPrompt, featurePrompt } = this.resolveIntroPrompts()
    this.presetPrompt = presetPrompt
    this.featurePrompt = featurePrompt
    this.outroPrompts = this.resolveOutroPrompts()
    this.injectedPrompts = []
    this.promptCompleteCbs = []
    this.afterInvokeCbs = []
    this.afterAnyInvokeCbs = []

    this.run = this.run.bind(this)

    const promptAPI = new PromptModuleAPI(this)
    promptModules.forEach(m => m(promptAPI))
  }

  async create(cliOptions = {}) {
    const { run, name, context, afterAnyInvokeCbs, afterInvokeCbs } = this

    // clone before mutating
    const preset = cloneDeep(defaults.presets.default)

    await clearConsole()
    logWithSpinner(`✨`, `Creating project in ${chalk.yellow(context)}.`)
    this.emit('creation', { event: 'creating' })

    const pm = new PackageManager({ context, forcePackageManager: packageManager })

    // STEP: generate package.json with plugin dependencies
    const pkg = {
      name,
      version: '0.1.0',
      private: true,
      devDependencies: {},
      ...resolvePkg(context)
    }
    const deps = Object.keys(preset.plugins)
    // deps.forEach(dep => {
    //   if (preset.plugins[dep]._isPreset) {
    //     return
    //   }

    //   // Note: the default creator includes no more than `@vue/cli-*` & `@vue/babel-preset-env`,
    //   // so it is fine to only test `@vue` prefix.
    //   // Other `@vue/*` packages' version may not be in sync with the cli itself.
    //   pkg.devDependencies[dep] = (
    //     preset.plugins[dep].version ||
    //     ((/^@vue/.test(dep)) ? `~${latestMinor}` : `latest`)
    //   )
    // })

    // write package.json
    await writeFileTree(context, {
      'package.json': JSON.stringify(pkg, null, 2)
    })

    // STEP: intilaize git repository
    logWithSpinner(`🗃`, `Initializing git repository...`)
    this.emit('creation', { event: 'git-init' })
    await run('git init')

    // STEP: install plugins
    stopSpinner()
    log(`⚙\u{fe0f}  Installing CLI plugins. This might take a while...`)
    log()
    this.emit('creation', { event: 'plugins-install' })
    await pm.install()

    // STEP: run generator
    log(`🚀  Invoking generators...`)
    this.emit('creation', { event: 'invoking-generators' })
    const plugins = await this.resolvePlugins(preset.plugins)
    const generator = new Generator(context, {
      pkg,
      plugins,
      afterInvokeCbs,
      afterAnyInvokeCbs
    })
    await generator.generate({
      extractConfigFiles: preset.useConfigFiles
    })
  }

  run (command, args) {
    if (!args) {
      [command, ...args] = command.split(/\s+/)
    }
    return execa(command, args, { cwd: this.context })
  }

  async promptAndResolvePreset (answers = null) {
    if (!answers) {
      await cleanConsole(true)
      answers = await inquirer.prompt(this.resolveFinalPropmpts())
    }
    debug('zn-cli:answers')(answers)

    if (answers.packageManager) {
      savedOptions({ packageManager: answers.packageManager })
    }

    let preset
    if (answers.preset && answers.preset !== '__manual__') {
      preset = await this.resolvePreset(answers.preset)
    } else {
      preset = {
        useConfigFiles: answers.useConfigFiles === 'files',
        plugins: {}
      }
      answers.features = answers.features || []
      this.promptCompleteCbs.forEach(cb => cb(answers, preset))
    }

    validatePreset(preset)

    if (answers.save && answers.saveName && savePreset(answers.saveName, preset)) {
      log()
      log(`🎉  Preset ${chalk.yellow(answers.saveName)} saved in ${chalk.yellow(rcPath)}`)
    }

    debug('zn-cli:preset')(preset)
    return preset
  }

  async resolvePreset (name, clone) {
    let preset
    const savedPresets = loadOptions().presets || {}

    if (name in savedPresets) {
      preset = savedPresets[name]
    } else if (preset.endsWith('.json') || /^\./.test(name) || path.isAbsolute(name)) {
      preset = await loadLocalPreset(path.resolve(name))
    } else if (name.includes('/')) {
      logWithSpinner(`Fetching remote preset ${chalk.cyan(name)}...`)
      this.emit('creation', { event: 'fetch-remote-preset'})
      try {
        preset = await loadRemotePreset(name, clone)
        stopSpinner()
      } catch (e) {
        stopSpinner()
        error(`Failed fetching remote preset ${chalk.cyan(name)}:`)
        throw e
      }
    }

    // use default preset if user has not overwritten it
    if (name === 'default' && !preset) {
      preset = defaults.presets.default
    }
    if (!preset) {
      error(`preset "${name}" not found.`)
      const presets = Object.keys(savedPresets)
      if (presets.length) {
        log()
        log(`available presets:\n${presets.join(`\n`)}`)
      } else {
        log(`you don't seem to have any saved preset.`)
        log(`run vue-cli in manual mode to create a preset.`)
      }
      exit(1)
    }
    return preset
  }

  // { id: options } => [{ id, apply, options }]
  async resolvePlugins (rawPlugins) {
    // ensure cli-service is invoked first
    rawPlugins = sortObject(rawPlugins, ['@vue/cli-service', true])
    const plugins = []
    for (const id of Object.keys(rawPlugins)) {
      const apply = loadModule(`${id}/generator`, this.context) || (() => {})
      let options = rawPlugins[id] || {}
      if (options.prompts) {
        const prompts = loadModule(`${id}/prompts`, this.context)
        if (prompts) {
          log()
          log(`${chalk.cyan(options._isPreset ? `Preset options:` : id)}`)
          options = await inquirer.prompt(prompts)
        }
      }
      plugins.push({ id, apply, options })
    }
    return plugins
  }

  getPresets () {
    const savedOptions = loadOptions()
    return Object.assign({}, savedOptions.presets, defaults.presets)
  }

  resolveIntroPrompts () {
    const presets = this.getPresets()
    const presetChoices = Object.keys(presets).map(name => {
      return {
        name: `${name} (${formatFeatures(presets[name])})`,
        value: name
      }
    })
    const presetPrompt = {
      name: 'preset',
      type: 'list',
      message: `Please pick a preset:`,
      choices: [
        ...presetChoices,
        {
          name: 'Manually select features',
          value: '__manual__'
        }
      ]
    }
    const featurePrompt = {
      name: 'features',
      when: isManualMode,
      type: 'checkbox',
      message: 'Check the features needed for your project:',
      choices: [],
      pageSize: 10
    }
    return {
      presetPrompt,
      featurePrompt
    }
  }

  resolveOutroPrompts () {
    const outroPrompts = [
      {
        name: 'useConfigFiles',
        when: isManualMode,
        type: 'list',
        message: 'Where do you prefer placing config for Babel, ESLint, etc.?',
        choices: [
          {
            name: 'In dedicated config files',
            value: 'files'
          },
          {
            name: 'In package.json',
            value: 'pkg'
          }
        ]
      },
      {
        name: 'save',
        when: isManualMode,
        type: 'confirm',
        message: 'Save this as a preset for future projects?',
        default: false
      },
      {
        name: 'saveName',
        when: answers => answers.save,
        type: 'input',
        message: 'Save preset as:'
      }
    ]
    // ask for packageManager once
    const savedOptions = loadOptions()
    if (!savedOptions.packageManager && hasYarn()) {
      const packageManagerChoices = []

      if (hasYarn()) {
        packageManagerChoices.push({
          name: 'Use Yarn',
          value: 'yarn',
          short: 'Yarn'
        })
      }

      packageManagerChoices.push({
        name: 'Use NPM',
        value: 'npm',
        short: 'NPM'
      })

      outroPrompts.push({
        name: 'packageManager',
        type: 'list',
        message: 'Pick the package manager to use when installing dependencies:',
        choices: packageManagerChoices
      })
    }

    return outroPrompts
  }

  resolveFinalPropmpts () {
     // patch generator-injected prompts to only show in manual mode
     this.injectedPrompts.forEach(prompt => {
      const originalWhen = prompt.when || (() => true)
      prompt.when = answers => {
        return isManualMode(answers) && originalWhen(answers)
      }
    })
    const prompts = [
      this.presetPrompt,
      this.featurePrompt,
      ...this.injectedPrompts,
      ...this.outroPrompts
    ]
    debug('vue-cli:prompts')(prompts)
    return prompts
  }

  shouldInitGit (cliOptions) {
    if (!hasGit()) {
      return false
    }
    // --git
    if (cliOptions.forceGit) {
      return true
    }
    // --no-git
    if (cliOptions.git === false || cliOptions.git === 'false') {
      return false
    }
    // default: true unless already in a git repo
    return !hasProjectGit(this.context)
  }
}


module.exports = Creator
