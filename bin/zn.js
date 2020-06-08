#!/usr/bin/env node

// Check node version

const chalk = require('chalk')
const semver = require('semver')
const packageJson = require('../package.json')
const requiredVersion = packageJson.engines.node
// console.log(process.argv)
// console.log(process.cwd())

function checkNodeVerion(wanted, id) {
  if (!semver.satisfies(process.version, wanted)) {
    console.log(chalk.red(
      'You are using Node ' + process.version + ', but this version of ' + id +
      ' requires Node ' + wanted + '.\nPlease upgrade your Node version.'
    ))
    process.exit(1)
  }
}

checkNodeVerion(requiredVersion, 'by-cli')

const program = require('commander') // The complete solution for node.js command-line interfaces
const leven = require('leven') // Measure the difference between two strings
const minimist = require('minimist') // parse argument options
/**
 * Suggest command
 * @param {string} unknownCommand
 */
function suggestCommands (unknownCommand) {
  const availableCommands = program.commands.map(cmd => cmd._name)

  let suggestion = ''

  availableCommands.forEach(cmd => {
    const isBestMatch = leven(cmd, unknownCommand) < leven(suggestion, unknownCommand)
    if (leven(cmd, unknownCommand) < 3 && isBestMatch) {
      suggestion = cmd
    }
  })

  if (suggestion) {
    console.log(`  ` + chalk.red(`Did you mean ${chalk.yellow(suggestion)}?`))
  }
}

function camelize (str) {
  return str.replace(/-(\w)/g, (_, c) => c ? c.toUpperCase() : '')
}

/**
 * commander passes the Command object itself as options,
 * extract only actual options into a fresh object.
 * @param {*} cmd
 */
function cleanArgs (cmd) {
  const args = {}
  cmd.options.forEach(o => {
    const key = camelize(o.long.replace(/^--/, ''))
    // if an option is not present and Command has a method with the same name
    // it should not be copied
    if (typeof cmd[key] !== 'function' && typeof cmd[key] !== 'undefined') {
      args[key] = cmd[key]
    }
  })

  return args
}

program
  .version(`zn-cli ${packageJson.version}`)
  .usage('<command> [options]')

program
  .command('create <app-name>')
  .description('create a new project power by zn-cli-service')
  .option('-d, --default', 'Skip prompts and use default preset')
  .option('--without-ts', 'It is use TS default, use this option to unuse TS')
  .option('-m, --mobile', 'Create an app for mobile')
  .option('-i, --support-ie', 'IE Support')
  .option('-f, --force', 'Overwrite target directory if it exists')
  .action((name, cmd) => {
    const options = cleanArgs(cmd)

    if (minimist(process.argv.slice(3))._.length > 1) {
      console.log(chalk.yellow('\n Info: You provided more than one argument. The first one will be used as the app\'s name, the rest are ignored.'))
    }
    if (process.argv.includes('-g') || process.argv.includes('--git')) {
      options.forceGit = true
    }
    require('../core/create')(name, options)
  })


// output help information on unknown commands
program
  .arguments('<command>')
  .action((cmd) => {
    program.outputHelp()
    console.log(`  ` + chalk.red(`Unknown command ${chalk.yellow(cmd)}.`))
    console.log()
    suggestCommands(cmd)
  })

program.parse(process.argv)

// If no arguments, output help information
if (!process.argv.slice(2).length) {
  program.outputHelp()
}
