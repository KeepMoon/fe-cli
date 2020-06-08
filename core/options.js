const fs = require('fs')
const cloneDeep = require('lodash.clonedeep')
const getRcPath = require('./utils/rc-path')
const { error } = require('../utils/logger')
const rcPath = getRcPath('.vuerc')

// Default preset
const defaultPreset = {
  useConfigFiles: true,
  router: true,
  redux: true,
  ts: true,
  cssPreprocessor: 'less',
  plugins: {
    babel: {},
    eslint: {
      config: 'base',
      lintOn: ['save']
    }
  }
}

const defaults = {
  lastChecked: undefined,
  latestVersion: undefined,
  packageManager: undefined,
  useTaobaoRegistry: undefined,
  presets: {
    'default': defaultPreset
  }
}

let cachedOptions

const loadOptions = () => {
  if (cachedOptions) {
    return cachedOptions
  }
  if (fs.existsSync(rcPath)) {
    try {
      cachedOptions = JSON.parse(fs.readFileSync(rcPath, 'utf-8'))
    } catch (e) {
      error(
        `Error loading saved preferences: ` +
        `~/.vuerc may be corrupted or have syntax errors. ` +
        `Please fix/delete it and re-run vue-cli in manual mode.\n` +
        `(${e.message})`
      )
      process.exit(1)
    }
    validate(cachedOptions, schema, () => {
      error(
        `~/.vuerc may be outdated. ` +
        `Please delete it and re-run vue-cli in manual mode.`
      )
    })
    return cachedOptions
  } else {
    return {}
  }
}

const saveOptions = toSave => {
  const options = Object.assign(cloneDeep(loadOptions()), toSave)
  for (const key in options) {
    if (!(key in defaults)) {
      delete options[key]
    }
  }
  cachedOptions = options
  try {
    fs.writeFileSync(rcPath, JSON.stringify(options, null, 2))
    return true
  } catch (e) {
    error(
      `Error saving preferences: ` +
      `make sure you have write access to ${rcPath}.\n` +
      `(${e.message})`
    )
  }
}

const savePreset = (name, preset) => {
  const presets = cloneDeep(loadOptions().presets || {})
  presets[name] = preset
  return saveOptions({ presets })
}

module.exports = {
  rcPath,
  defaults,
  defaultPreset,
  loadOptions,
  saveOptions,
  savePreset
}
