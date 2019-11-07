const PostgresDb = require('../PostgresDb');
const { Systems } = require('../Constants');
const { formatDisplayDate } = require('../Utils');

let processSearchResults = function(results) {
  return results.map(record => {
    return {
      id: record.id,
      firstName: record.first_name,
      lastName: record.last_name,
      dob: record.dob ? formatDisplayDate(record.dob) : null,
      nino: record.nino,
      address: record.address,
      source: Systems.SINGLEVIEW,
      links: record.links
    };
  });
};

let Backend = {
  customerSearch: async function(queryParams) {
    try {
      let whereClause = [];
      let params = {};

      if (queryParams.firstName && queryParams.firstName !== '') {
        whereClause.push('first_name ILIKE ${firstName}');
        params.firstName = queryParams.firstName;
      }

      if (queryParams.lastName && queryParams.lastName !== '') {
        whereClause.push('last_name ILIKE ${lastName}');
        params.lastName = queryParams.lastName;
      }

      let customers = await PostgresDb.any(
        `SELECT customers.*, customer_links.remote_id, systems.name as system_name 
          FROM customers
          JOIN customer_links ON customers.id = customer_links.customer_id
          JOIN systems ON systems.id = customer_links.system_id
          WHERE (${whereClause.join(' AND ')})`,
        params
      );

      customers = customers.reduce((acc, customer) => {
        if (!acc[customer.id]) {
          acc[customer.id] = customer;
          acc[customer.id].links = [];
        }
        acc[customer.id].links.push({
          source: customer.system_name,
          id: customer.remote_id
        });
        return acc;
      }, {});
      customers = Object.values(customers);

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
