const { execSync } = require('child_process')
const LRU = require('lru-cache')

let _hasYarn = null
const _yarnProjects = new LRU({
  max: 10,
  maxAge: 1000
})

const hasYarn = () => {
  if(_hasYarn !== null) {
    return _hasYarn
  }
  try {
    execSync('yarn --version', { stdio: 'ignore' })
    return (_hasYarn = true)
  } catch (e) {
    return (_hasYarn = fasle)
  }
}

function checkYarn (result) {
  if (result && !hasYarn()) {
    throw new Error(`The project seems to require yarn but it's not installed.`)
  }
  return result
}

const hasProjectYarn = (cwd) => {
  if (_yarnProjects.has(cwd)) {
    return checkYarn(_yarnProjects.get(cwd))
  }

  const lockFile = path.join(cwd, 'yarn.lock')
  const result = fs.existsSync(lockFile)
  _yarnProjects.set(cwd, result)
  return checkYarn(result)
}

let _hasGit = null
const hasGit = () => {
  if (_hasGit != null) {
    return _hasGit
  }
  try {
    execSync('git --version', { stdio: 'ignore' })
    return (_hasGit = true)
  } catch (e) {
    return (_hasGit = false)
  }
}

module.exports = {
  hasYarn,
  hasGit,
  hasProjectYarn
}
