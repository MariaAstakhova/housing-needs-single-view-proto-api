const PostgresDb = require("../PostgresDb");

let processResults = function(results) {
  return results.map(record => {
    return {
      id: record.id,
      firstName: record.first_name,
      lastName: record.last_name,
      dob: record.dob ? record.dob : null,
      nino: record.nino,
      address: record.address,
      source: "SINGLEVIEW"
    };
  });
};

let Backend = {
  customerSearch: function(queryParams, cb) {
    let whereClause = [];
    let params = [];

    if (queryParams.firstName && queryParams.firstName !== "") {
      whereClause.push(`first_name ILIKE $${params.length + 1}`);
      params.push(`%${queryParams.firstName}%`);
    }

    if (queryParams.lastName && queryParams.lastName !== "") {
      whereClause.push(`last_name ILIKE $${params.length + 1}`);
      params.push(`%${queryParams.lastName}%`);
    }

    PostgresDb.any(
      `SELECT * FROM customers WHERE (${whereClause.join(" AND ")})`,
      params
    ).then(customers => {
      cb(processResults(customers));
    });
  },

  fetchCustomerNotes: function(id, cb) {
    cb([]);
  }
};

module.exports = Backend;
