const path = require('path')
const chalk = require('chalk')
const fs = require('fs-extra')
const inquirer = require('inquirer')
const validateProjectName = require('./utils/validate-project-name');
const { clearConsole, error } = require('../utils/logger')
const {  stopSpinner } = require('../utils/spinner')

const Creator = require('./Creator')

const create = async (projectName, options) => {

  const cwd = options.cwd || process.cwd()
  // 是否在当前目录创建新项目
  const inCurrent = projectName === '.'
  const name = inCurrent ? path.relative('../', cwd) : projectName
  const targetDir = path.resolve(cwd, projectName || '.')

  // validate project name
  const result = validateProjectName(name)
  if (!result.validForNewPackages) {
    console.error(chalk.red(`Invalid project name: "${name}"`))
    result.errors && result.errors.forEach(err => {
      console.error(chalk.red.dim('Error: ' + err))
    })
    result.warnings && result.warnings.forEach(warn => {
      console.error(chalk.red.dim('Warning: ' + warn))
    })
    process.exit(1)
  }

  // Make sure the target directory
  if (fs.existsSync(targetDir) && !options.merge) {
    if (options.force) {
      await fs.remove(targetDir)
    } else {
      await clearConsole()
      if (inCurrent) {
        const { ok } = await inquirer.prompt([
          {
            name: 'ok',
            type: 'confirm',
            message: 'Generate project in current directory?'
          }
        ])
        if (!ok) {
          return
        }
      } else {
        const { action } = await inquirer.prompt([
          {
            name: 'action',
            type: 'list',
            message: `Target directory ${chalk.cyan(targetDir)} already exists. Pick an action:`,
            choices: [
              { name: 'Overwrite', value: 'overwrite' },
              { name: 'Merge', value: 'merge' },
              { name: 'Cancel', value: false}
            ]
          }
        ])
        if (!action) {
          reutrn
        } else if (action === 'overwrite') {
          console.log(`\nRemoving ${chalk.cyan(targetDir)}...`)
          await fs.remove(targetDir)
        }
      }
    }
  }

  const creator = new Creator(name, targetDir, []) //getPromptModules())
  await creator.create(options)
}

module.exports = function (...args) {
  console.log(args)
  return create(...args).catch(err => {
    stopSpinner(false)
    error(err)
    process.exit(1)
  })
}
