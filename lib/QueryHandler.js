const PostgresDb = require('./PostgresDb');
const moment = require('moment');
const { Systems } = require('./Constants');
const merge = require('@brikcss/merge');

const backends = {
  [Systems.UHT_CONTACTS]: require('./backends/UHT-Contacts'),
  [Systems.UHT_HOUSING_REGISTER]: require('./backends/UHT-HousingRegister'),
  [Systems.UHW]: require('./backends/UHW'),
  [Systems.ACADEMY_BENEFITS]: require('./backends/Academy-Benefits'),
  [Systems.ACADEMY_COUNCIL_TAX]: require('./backends/Academy-CouncilTax'),
  [Systems.JIGSAW]: require('./backends/Jigsaw'),
  [Systems.SINGLEVIEW]: require('./backends/SingleView')
};

// Combine values from multiple records and select the most likely match for a parameter
let getParam = function(param, records, lambda) {
  let results = {};
  records.forEach(record => {
    if (record && record[param]) {
      let field = lambda ? lambda(record[param]) : record[param];
      results[field] = results[field] ? results[field] + 1 : 1;
    }
  });
  if (Object.keys(results).length > 0) {
    let results_arr = Object.entries(results);
    results_arr.sort((a, b) => b[1] - a[1]);
    return results_arr[0][0];
  } else {
    return null;
  }
};

let extractConnectedRecords = function(records) {
  records.connected = records.ungrouped.filter(record => {
    return record.source === Systems.SINGLEVIEW;
  });

  records.connected.forEach(record => {
    // remove grouped values from records to group
    delete records.ungrouped[records.ungrouped.indexOf(record)];
  });
  records.ungrouped = records.ungrouped.filter(x => x);

  return records;
};

let groupByUhContact = function(records) {
  let grouped = records.ungrouped.reduce((acc, record) => {
    if (record.links && record.links.uhContact) {
      if (!acc[record.links.uhContact]) {
        acc[record.links.uhContact] = [];
      }
      acc[record.links.uhContact].push(record);
    }
    return acc;
  }, {});
  // set the grouped records to those we just grouped
  records.grouped = Object.values(grouped);

  // loop through all grouped records
  records.grouped.forEach(group => {
    group.forEach(record => {
      record.groupCertainty = 100;
      // remove grouped values from records to group
      delete records.ungrouped[records.ungrouped.indexOf(record)];
    });
  });
  records.ungrouped = records.ungrouped.filter(x => x);
  return records;
};

let groupByNino = function(records) {
  return records;
};

let groupByDoB = function(records) {
  let newlyGrouped = [];
  records.ungrouped.forEach(record => {
    records.grouped.forEach(group => {
      for (let i = 0; i < group.length; i++) {
        let groupedRecord = group[i];
        if (record.dob && record.dob === groupedRecord.dob) {
          record.groupCertainty = 75;
          group.push(record);
          newlyGrouped.push(record);
          break;
        }
      }
    });
  });
  // remove grouped items
  newlyGrouped.forEach(record => {
    delete records.ungrouped[records.ungrouped.indexOf(record)];
  });
  records.ungrouped = records.ungrouped.filter(x => x);
  return records;
};

let groupByPostcode = function(records) {
  return records;
};

let groupRecords = function(records) {
  let output = { grouped: [], ungrouped: records, connected: [] };
  // Pull out previously connected records
  output = extractConnectedRecords(output);

  // Group records that share the same uhContact link data because we know they are actually linked
  output = groupByUhContact(output);

  // Group records that share the NI no
  output = groupByNino(output);

  // Add likely matches for DoB
  output = groupByDoB(output);

  // Add likely matches for postcode
  output = groupByPostcode(output);

  // Remove groups of 1

  return output;
};

let getCustomerLinks = async function(id) {
  const query = `
    SELECT customer_links.remote_id, systems.name FROM customer_links, customers, systems 
    WHERE systems.id = customer_links.system_id AND customers.id = customer_links.customer_id AND customers.id = $1`;
  return await PostgresDb.any(query, [id]);
};

// Remove nulls and duplicates from an array
let filterArray = function(array) {
  let lookup = array.filter(x => x).map(el => JSON.stringify(el));
  return array
    .filter(x => x)
    .filter((value, index) => {
      return lookup.indexOf(JSON.stringify(value)) === index;
    });
};

// Recursively filter duplicates from arrays in objects
let filterArrays = function(input) {
  for (let key in input) {
    if (Array.isArray(input[key])) {
      input[key] = filterArray(input[key]);
    } else if (typeof input[key] === 'object') {
      filterArrays(input[key]);
    }
  }
};

// Merge and tidy response upjects from multiple backends
let mergeResponses = function(responses) {
  let merged = merge(...responses);
  filterArrays(merged);
  return merged;
};

const QueryHandler = {
  searchCustomers: async query => {
    const requests = Object.entries(backends).map(async ([system, backend]) => {
      try {
        return backend.customerSearch(query);
      } catch (err) {
        console.log(`Error searching customers in ${system}: ${err}`);
      }
    });

    const results = [].concat.apply([], await Promise.all(requests));

    return groupRecords(results);
  },

  saveCustomer: async input => {
    // insert into customers table
    const insertCustQuery =
      'INSERT INTO customers (first_name, last_name, address, dob, nino) VALUES ($1, $2, $3, $4, $5) RETURNING id';

    // insert into customer_links table
    const insertLinkQuery =
      'INSERT INTO customer_links (customer_id, system_id, remote_id) VALUES ($1, (SELECT id FROM systems WHERE name = $2), $3)';

    const customer = await PostgresDb.one(insertCustQuery, [
      getParam('firstName', input.customers, name =>
        name ? name.toUpperCase() : null
      ),
      getParam('lastName', input.customers, name =>
        name ? name.toUpperCase() : null
      ),
      getParam('address', input.customers, address =>
        address ? address.toUpperCase() : null
      ),
      getParam('dob', input.customers, dob =>
        dob ? moment(dob, 'DD/MM/YYYY').format() : null
      ),
      getParam('nino', input.customers, nino =>
        nino ? nino.toUpperCase() : null
      )
    ]);

    await PostgresDb.task(t => {
      const tp = input.customers
        .filter(x => x !== null)
        .map(c => {
          return t.none(insertLinkQuery, [
            customer.id,
            c.source,
            c.id.toString()
          ]);
        });

      return Promise.all(tp);
    });
    return customer.id;
  },

  fetchCustomer: async id => {
    const links = await getCustomerLinks(id);

    let requests = links.map(async link => {
      try {
        return backends[link.name].fetchCustomer(link.remote_id);
      } catch (err) {
        console.log(`Error fetching customers in ${link.name}: ${err}`);
      }
    });

    const results = await Promise.all(requests);
    let customer = mergeResponses(results);

    if (!customer.housingRegister) {
      customer.housingRegister = {};
    }

    if (!customer.housingNeeds) {
      customer.housingNeeds = {};
    }

    return customer;
  },

  fetchCustomerNotes: async id => {
    const links = await getCustomerLinks(id);

    let requests = links.map(async link => {
      try {
        return backends[link.name].fetchCustomerNotes(link.remote_id);
      } catch (err) {
        console.log(`Error fetching customer notes in ${link.name}: ${err}`);
      }
    });

    let results = [].concat.apply([], await Promise.all(requests));
    results = results.sort((a, b) => b.date - a.date);

    return { notes: results };
  },

  fetchCustomerDocuments: async id => {
    const links = await getCustomerLinks(id);

    let requests = links.map(async link => {
      try {
        return backends[link.name].fetchCustomerDocuments(link.remote_id);
      } catch (err) {
        `Error fetching customer documents in ${link.name}: ${err}`;
      }
    });

    let results = [].concat.apply([], await Promise.all(requests));
    results = results.sort((a, b) => b.date - a.date);
    return { documents: results };
  }
};

module.exports = QueryHandler;
