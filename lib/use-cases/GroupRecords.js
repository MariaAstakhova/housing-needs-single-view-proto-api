module.exports = options => {
  const Systems = options.Systems;

  const extractConnectedRecords = function(records) {
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
            return (
              record.source === link.system_name && record.id === link.remote_id
            );
          })
          .forEach(record => {
            delete records.ungrouped[records.ungrouped.indexOf(record)];
          });
      });
    });
    records.ungrouped = records.ungrouped.filter(x => x);

    return records;
  };

  const extractUniqueValues = function(key_fn, obj) {
    return obj
      .map(key_fn)
      .filter(x => x)
      .filter((item, index, self) => {
        return self.indexOf(item) === index;
      });
  };

  const group = function(key_fn, records) {
    let grouped = records.ungrouped.reduce((acc, record) => {
      let key = key_fn(record);
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(record);
      return acc;
    }, {});
    // add to the grouped records
    records.grouped = records.grouped.concat(Object.values(grouped));

    // loop through all grouped records
    records.grouped.forEach(group => {
      group.forEach(record => {
        // remove grouped values from records to group
        delete records.ungrouped[records.ungrouped.indexOf(record)];
      });
    });

    // group the groups
    records.grouped.forEach(group => {
      let keys = extractUniqueValues(key_fn, group);

      if (keys.length > 0) {
        for (let index in records.grouped) {
          let otherGroup = records.grouped[index];
          if (group !== otherGroup) {
            let otherKeys = extractUniqueValues(key_fn, otherGroup);
            let intersection = keys.filter(value => otherKeys.includes(value));
            if (intersection.length > 0) {
              // There is a match, so move the current group into the other group
              records.grouped[index] = otherGroup.concat(group);
              // Remove the current group
              delete records.grouped[records.grouped.indexOf(group)];
              break;
            }
          }
        }
      }
    });

    records.grouped = records.grouped.filter(x => x);
    records.ungrouped = records.ungrouped.filter(x => x);
    return records;
  };

  return records => {
    let output = { grouped: [], ungrouped: records, connected: [] };
    // Pull out previously connected records
    output = extractConnectedRecords(output);

    // Group records that share the same uhContact link data because we know they are actually linked
    group(record => {
      if (record.links && record.links.uhContact) return record.links.uhContact;
    }, output);

    // Group records that share the same hbClaimId link data because we know they are actually linked
    group(record => {
      if (record.links && record.links.hbClaimId) return record.links.hbClaimId;
    }, output);

    // Group records that share the NI no
    group(record => record.nino, output);

    // Add likely matches for DoB
    group(record => record.dob, output);

    // Move groups of 1 to ungrouped
    output.grouped
      .filter(x => x.length === 1)
      .forEach(g => {
        output.ungrouped.push(g[0]);
      });

    output.grouped = output.grouped.filter(x => x.length > 1);

    return output;
  };
};
