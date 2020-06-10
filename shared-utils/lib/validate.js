const joi = require('@hapi/joi')

exports.createSchema = (fn) => fn(joi)

exports.validate = (obj, shcema, cb) => {
  joi.validate(obj, shcema, {}, (err) => {
    if (err) {
      cb(err.message)
      process.exit(1)
    }
  })
}

exports.validateSync = (obj, shcema) => {
  const result = joi.validate(obj, shcema)
  if (result.error) {
    throw result.error
  }
}
