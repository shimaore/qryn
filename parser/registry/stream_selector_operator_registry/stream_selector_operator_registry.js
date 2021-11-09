const { _and, unquote_token, querySelectorPostProcess, isEOF } = require('../common')
const { DATABASE_NAME } = require('../../../lib/utils')
/**
 * @param regex {boolean}
 * @param eq {boolean}
 * @param label {string}
 * @param value {string}
 * @returns {string[]}
 */
function selector_clauses (regex, eq, label, value) {
  return [
        `JSONHas(labels, '${label}')`,
        regex
          ? `extractAllGroups(JSONExtractString(labels, '${label}'), '(${value})') ${eq ? '!=' : '=='} []`
          : `JSONExtractString(labels, '${label}') ${eq ? '=' : '!='} '${value}'`
  ]
}

/**
 *
 * @param token {Token}
 * @returns {string[]}
 */
const label_and_val = (token) => {
  const label = token.Child('label').value
  return [label, unquote_token(token)]
}

/**
 * @returns {registry_types.Request}
 */
const stream_select_query = () => {
  return {
    select: ['fingerprint'],
    from: `${DATABASE_NAME()}.time_series`,
    where: ['AND']
  }
}

/**
 * @param query {registry_types.Request}
 * @param clauses {string[]}
 * @returns {registry_types.Request}
 */
module.exports.simple_and = (query, clauses) => {
  const is_str_sel = query.with && query.with.str_sel
  let str_sel = is_str_sel ? query.with.str_sel : stream_select_query()
  str_sel = _and(str_sel, clauses)
  query = {
    ...query,
    with: {
      ...(query.with || {}),
      str_sel: str_sel
    }
  }
  if (is_str_sel) {
    return query
  }
  return querySelectorPostProcess(_and(query, ['samples.fingerprint IN str_sel']))
}

/**
 *
 * @param token {Token}
 * @param query {registry_types.Request}
 * @returns {string[]}
 */
module.exports.neq_simple = (token, query) => {
  const [label, value] = label_and_val(token)
  return selector_clauses(false, false, label, value)
}

/**
 *
 * @param token {Token}
 * @param query {registry_types.Request}
 * @returns {string[]}
 */
module.exports.neq_extra_labels = (token, query) => {
  const [label, value] = label_and_val(token)
  return [['OR', `arrayExists(x -> x.1 == '${label}' AND x.2 != '${value}', extra_labels) != 0`,
    [
      'AND',
                `arrayExists(x -> x.1 == '${label}', extra_labels) == 0`,
                ...selector_clauses(false, false, label, value)
    ]
  ]]
}

/**
 *
 * @param s {DataStream}
 * @param fn {function(Object): boolean}
 */
function filter (s, fn) {
  return s.filter(e => (e && e.labels && fn(e)) || isEOF(e))
}

/**
 *
 * @param token {Token}
 * @param query {registry_types.Request}
 * @returns {function({labels: Object}): boolean}
 */
module.exports.neq_stream = (token, query) => {
  const [label, value] = label_and_val(token)
  return (e) => e.labels[label] && e.labels[label] !== value
}

/**
 *
 * @param token {Token}
 * @param query {registry_types.Request}
 * @returns {string[]}
 */
module.exports.nreg_simple = (token, query) => {
  const [label, value] = label_and_val(token)
  return selector_clauses(true, false, label, value)
}

/**
 *
 * @param token {Token}
 * @param query {registry_types.Request}
 * @returns {string[]}
 */
module.exports.nreg_extra_labels = (token, query) => {
  const [label, value] = label_and_val(token)

  return [['OR', `arrayExists(x -> x.1 == '${label}' AND extractAllGroups(x.2, '(${value})') == [], extra_labels) != 0`,
    [
      'AND',
                `arrayExists(x -> x.1 == '${label}', extra_labels) == 0`,
                ...selector_clauses(true, true, label, value)
    ]
  ]]
}

/**
 *
 * @param token {Token}
 * @param query {registry_types.Request}
 * @returns {function({labels: Object}): boolean}
 */
module.exports.nreg_stream = (token, query) => {
  const [label, value] = label_and_val(token)
  const re = new RegExp(value)
  return (e) => e.labels[label] && !e.labels[label].match(re)
}

/**
 *
 * @param token {Token}
 * @param query {registry_types.Request}
 * @returns {string[]}
 */
module.exports.reg_simple = (token, query) => {
  const [label, value] = label_and_val(token)
  return selector_clauses(true, true, label, value)
}

/**
 *
 * @param token {Token}
 * @param query {registry_types.Request}
 * @returns {string[]}
 */
module.exports.reg_extra_labels = (token, query) => {
  const [label, value] = label_and_val(token)

  return [['OR', `arrayExists(x -> x.1 == '${label}' AND extractAllGroups(x.2, '(${value})') != [], extra_labels) != 0`,
    [
      'AND',
                `arrayExists(x -> x.1 == '${label}', extra_labels) == 0`,
                ...selector_clauses(true, true, label, value)
    ]
  ]]
}

/**
 *
 * @param token {Token}
 * @param query {registry_types.Request}
 * @returns {function({labels: Object}): boolean}
 */
module.exports.reg_stream = (token, query) => {
  const [label, value] = label_and_val(token)
  const re = new RegExp(value)
  return (e) => e.EOF || (e && e.labels &&e.labels[label] && e.labels[label].match(re))
}

/**
 *
 * @param token {Token}
 * @param query {registry_types.Request}
 * @returns {string[]}
 */
module.exports.eq_simple = (token, query) => {
  const [label, value] = label_and_val(token)
  return selector_clauses(false, true, label, value)
}
/**
 *
 * @param token {Token}
 * @param query {registry_types.Request}
 * @returns {string[]}
 */
module.exports.eq_extra_labels = (token, query) => {
  const [label, value] = label_and_val(token)

  return [['OR', `indexOf(extra_labels, ('${label}', '${value}')) > 0`,
    [
      'AND',
        `arrayExists(x -> x.1 == '${label}', extra_labels) == 0`,
        ...selector_clauses(false, true, label, value)
    ]
  ]]
}

/**
 *
 * @param token {Token}
 * @param query {registry_types.Request}
 * @returns {function({labels: Object}): boolean}
 */
module.exports.eq_stream = (token, query) => {
  const [label, value] = label_and_val(token)
  return (e) => e.EOF || (e && e.labels && e.labels[label] && e.labels[label] === value)
}
