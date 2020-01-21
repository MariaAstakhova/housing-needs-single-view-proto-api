module.exports = options => {
  return {
    cleanCustomerRecord: require('./CleanCustomerRecord')(options),
    groupRecords: require('./GroupRecords')(options),
    searchCustomers: require('./SearchCustomers')(options)
  };
};
