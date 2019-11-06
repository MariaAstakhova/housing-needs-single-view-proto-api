let Utils = {
  formatPhone: function(input) {
    let cleaned = input.replace(/ /g, '');
    if (cleaned === '') return null;
    return cleaned;
  },

  formatAddress(input) {
    if (!Utils.checkString(input)) return null;
    return input
      .split(/[\n\r]+/g)
      .map(l => Utils.nameCase(l.trim()))
      .join('\n');
  },

  checkString(input) {
    if (typeof input === 'string') input = input.trim();
    if (input === '') return null;
    return input;
  },

  nameCase(input) {
    input = Utils.checkString(input);
    if (!input) return null;
    return input.charAt(0).toUpperCase() + input.toLowerCase().slice(1);
  }
};

module.exports = Utils;
