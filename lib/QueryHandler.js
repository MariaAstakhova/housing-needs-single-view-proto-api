const sqlite3 = require('better-sqlite3');
const db = new sqlite3('singleview.db')//, { verbose: console.log });
var generateOutputJson = require('./Utils').generateOutputJson;

const backends = {
  'UHT-Contacts': require('./backends/UHT-Contacts'),
  'UHT-HousingRegister': require('./backends/UHT-HousingRegister'),
  'UHTDummy': require('./backends/UHTDummy'),
  'UHW': require('./backends/UHW'),
  'UHWDummy': require('./backends/UHWDummy'),
  'ACADEMY': require('./backends/Academy'),
  'ACADEMYDummy': require('./backends/AcademyDummy'),
  'JIGSAW': require('./backends/Jigsaw'),
  'JIGSAWDummy': require('./backends/JigsawDummy'),
  'SINGLEVIEW': require('./backends/SingleView')
}

// Combine values from multiple records and select the most likely match for a parameter
let getParam = function(param, records, lambda){
  let results = {};
  records.forEach(record => {
    if(record[param]){
      let field = lambda ? lambda(record[param]) : record[param];
      results[field] = results[field] ? results[field] + 1 : 1
    }
  })
  if(Object.keys(results).length > 0){
    let results_arr = Object.entries(results);
    results_arr.sort((a, b) => b[1] - a[1])
    return results_arr[0][0]
  }else{
    return null
  }
}

let extractConnectedRecords = function(records){
  records.connected = records.ungrouped.filter(record => {
    return record.source === 'SINGLEVIEW';
  });

  records.connected.forEach(record => {
    // remove grouped values from records to group
    delete records.ungrouped[records.ungrouped.indexOf(record)];
  });
  records.ungrouped = records.ungrouped.filter(x => x);

  return records;
}

let groupByUhContact = function(records){
  let grouped = records.ungrouped.reduce((acc, record) => {
    if(record.links && record.links.uhContact){
      if(!acc[record.links.uhContact]){
        acc[record.links.uhContact] = []
      }
      acc[record.links.uhContact].push(record);
    }
    return acc;
  }, {})
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
}

let groupByNino = function(records){
  return records;
}

let groupByDoB = function(records){
  let newlyGrouped = [];
  records.ungrouped.forEach(record => {
    records.grouped.forEach(group => {
      for(let i=0; i< group.length; i++){
        let groupedRecord = group[i];
        if(record.dob === groupedRecord.dob){
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
}

let groupByPostcode = function(records){
  return records;
}

let groupRecords = function(records){
  let output = {grouped: [], ungrouped: records, connected: []}
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
}

let getCustomerLinks = function(id){
  const selectCust = db.prepare('SELECT customer_links.remote_id, systems.name FROM customer_links, customers, systems WHERE systems.id = customer_links.system_id AND customers.id = customer_links.customer_id AND customers.id = ?');

  return selectCust.all(id);
}

let QueryHandler = {
  searchCustomers: function(query, systems, cb){
    let queryCount = systems.length;
    let results = [];
    systems.forEach(system => {
      backends[system].customerSearch(query, result => {
        queryCount--;

        results = results.concat(result)
        if(queryCount == 0){
          cb(groupRecords(results));
        }
      })
    })
  },

  saveCustomer: function(input, cb){
    let customer_id;
    let customer = {
      first_name: getParam('firstName', input.customers, name => name.toUpperCase()),
      last_name: getParam('lastName', input.customers, name => name.toUpperCase()),
      address: getParam('address', input.customers, name => name.toUpperCase()),
      dob: getParam('dob', input.customers),
      nino: getParam('nino', input.customers, name => name.toUpperCase())
    }

    // Insert into customers table
    const insertCust = db.prepare('INSERT INTO customers (first_name, last_name, address, dob, nino) VALUES ($first_name, $last_name, $address, $dob, $nino)');

    // Insert into customer_links table
    const insertLink = db.prepare('INSERT INTO customer_links (customer_id, system_id, remote_id) VALUES (?, (SELECT id FROM systems WHERE name = ?), ?)');

    const createCustomer = db.transaction((cust) => {
      const info = insertCust.run(customer)
      customer_id = info.lastInsertRowid;
      cust.forEach(customer => {
        insertLink.run(customer_id, customer.source, customer.id.toString());
      })
    });

    createCustomer(input.customers);
    cb(customer_id);
  },

  fetchCustomer: function(id, systems, cb){
    let customer = {id: id, housingRegister:{}, household: [], options: {}};
    let customerLinks = getCustomerLinks(id);

    let queryCount = customerLinks.length;
    customerLinks.forEach(link => {
      backends[link.name].fetchCustomer(link.remote_id, customer, err => {
        queryCount--;
        if(queryCount == 0){
          cb(generateOutputJson(customer));
        }
      })
    })
  },

  fetchCustomerNotes: function(id, systems, cb){
    let customerLinks = getCustomerLinks(id);
    let queryCount = customerLinks.length;
    let results = [];

    customerLinks.forEach(link => {
      backends[link.name].fetchCustomerNotes(link.remote_id, result => {
        queryCount--;
        results = results.concat(result)
        if(queryCount == 0){
          results = results.sort((a,b) => b.date - a.date);
          cb({notes: results});
        }
      })
    })
  },
}

module.exports = QueryHandler;