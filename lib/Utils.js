let selectMostLikely = function(input){
  let results = {};
  input.forEach(record => {
    results[record] = results[record] ? results[record] + 1 : 1
  })
  let results_arr = Object.entries(results);
  results_arr.sort((a, b) => b[1] - a[1])
  return results_arr[0][0]
}

let Utils = {
  addOptionProp: function(output, prop, value){
    if(value){
      if(typeof value === 'string') value = value.trim();
      if(typeof output[prop] === 'undefined') output[prop] = [];
      output[prop].push(value);
    }
  },

  formatPhone: function(input){
    return input.replace(/ /g, '')
  },

  generateOutputJson(input){
    let output = {};
    Object.keys(input).forEach(k => {
      if(k !== 'options'){
        output[k] = input[k];
      }
    });
    Object.keys(input.options).forEach(k => {
      output[k] = selectMostLikely(input.options[k]);
    });
    return output;
  }
}


module.exports = Utils;