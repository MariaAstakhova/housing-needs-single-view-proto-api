const PostgresDb = require('../PostgresDb');
const { Systems } = require('../Constants');
const moment = require('moment');

let processSearchResults = function(results) {
  return results.map(record => {
    return {
      id: record.id,
      firstName: record.first_name,
      lastName: record.last_name,
      dob: record.dob ? moment(record.dob).format('DD/MM/YYYY') : null,
      nino: record.nino,
      address: record.address,
      source: Systems.SINGLEVIEW
    };
  });
};

let Backend = {
  customerSearch: async function(queryParams) {
    try {
      let whereClause = [];
      let params = [];

      if (queryParams.firstName && queryParams.firstName !== '') {
        whereClause.push(`first_name ILIKE $${params.length + 1}`);
        params.push(`%${queryParams.firstName}%`);
      }

      if (queryParams.lastName && queryParams.lastName !== '') {
        whereClause.push(`last_name ILIKE $${params.length + 1}`);
        params.push(`%${queryParams.lastName}%`);
      }

      const customers = await PostgresDb.any(
        `SELECT * FROM customers WHERE (${whereClause.join(' AND ')})`,
        params
      );

      return processSearchResults(customers);
    } catch (err) {
      console.log(`Error searching linked records in SingleView: ${err}`);
    }
  },

  fetchCustomerNotes: async function() {
    return Promise.resolve([]);
  },

  fetchCustomerDocuments: async function() {
    return Promise.resolve([]);
  }
};

module.exports = Backend;
