const moment = require('moment');
const fs = require('fs');
const path = require('path');

let Utils = {
  formatPhone: function(input) {
    let cleaned = input.replace(/ /g, '');
    if (cleaned === '') return null;
    return cleaned;
  },

  addressCase: function(input) {
    // Uses the UK government regex to match a postcode
    if (
      input.match(
        /([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9][A-Za-z]?))))\s?[0-9][A-Za-z]{2})/
      )
    ) {
      return input.toUpperCase();
    } else {
      return input
        .split(' ')
        .map(el => Utils.nameCase(el))
        .join(' ');
    }
  },

  formatAddress(input) {
    if(!input) return []
    if (typeof input === 'string') {
      input = input.split(/[\n\r]+/g);
    }
    if (typeof input.length === 'undefined') {
      return [];
    }

    return input
      .filter(el => el) // Remove null elements from the array
      .map(el => el.trim()) // Trim the string
      .filter(el => el !== '') // Remove empty strings from the array
      .map(el => Utils.addressCase(el)); // Normalise the case
  },

  checkString(input) {
    if (typeof input === 'string') input = input.trim();
    if (input === '') return null;
    return input;
  },

  nameCase(input) {
    input = Utils.checkString(input);
    if (!input) return null;
    return input
      .split(' ')
      .map(i => {
        return i.charAt(0).toUpperCase() + i.toLowerCase().slice(1);
      })
      .join(' ');
  },

  formatDisplayDate(input) {
    return moment(input).format('DD/MM/YYYY');
  },

  formatRecordDate(input) {
    return moment(input).format('YYYY-MM-DD');
  },

  dedupe(arr, key_lambda) {
    return Object.values(
      arr.reduce((acc, item) => {
        acc[key_lambda(item)] = item;
        return acc;
      }, {})
    );
  },

  loadSQL(directory) {
    var files = fs.readdirSync(directory);
    return files.reduce((acc, file) => {
      if (file.match(/.*\.sql/)) {
        acc[`${file.replace('.sql', '')}SQL`] = fs.readFileSync(
          path.join(directory, file),
          'utf8'
        );
      }
      return acc;
    }, {})
  }
};

module.exports = Utils;
