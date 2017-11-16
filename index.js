'use strict';

module.exports.rules = {
  'sort-imports': require(`${__dirname}/rules/sort-imports.js`),
};

module.exports.configs = {
  'recommended': {
    'rules': {
      'sort-imports/sort-imports': 2,
    },
  },
};
