const { Systems } = require('./Constants');

let extractConnectedRecords = function(records) {
  records.connected = records.ungrouped.filter(record => {
    return record.source === Systems.SINGLEVIEW;
  });

  records.connected.forEach(record => {
    // remove grouped values from records to group
    delete records.ungrouped[records.ungrouped.indexOf(record)];

    // remove previously connected records from the list
    record.links.forEach(link => {
      records.ungrouped
        .filter(record => {
          return record.source === link.source && record.id === link.id;
        })
        .forEach(record => {
          delete records.ungrouped[records.ungrouped.indexOf(record)];
        });
    });
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

module.exports = { groupRecords };
