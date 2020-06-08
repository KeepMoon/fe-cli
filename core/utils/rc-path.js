const os = require('os')
const fs = require('fs')
const path = require('path')

const xdgConfigPath = file => {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME
  if (xdgConfigHome) {
    const rcDir = path.join(xdgConfigHome, 'vue')
    if (!fs.existsSync(rcDir)) {
      fs.ensureDirSync(rcDir, 0o700)
    }
    return path.join(rcDir, file)
  }
}

const getRcPath = file => {
  return (
    process.env.VUE_CLI_CONFIG_PATH ||
    xdgConfigPath(file) ||
    path.join(os.homedir(), file)
  )
}

module.exports = getRcPath
