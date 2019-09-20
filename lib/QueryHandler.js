let backends = {
  'UHT': require('./backends/UHT'),
  'UHTDummy': require('./backends/UHTDummy'),
  'UHW': require('./backends/UHW'),
  'UHWDummy': require('./backends/UHWDummy'),
  'Academy': require('./backends/Academy'),
  'AcademyDummy': require('./backends/AcademyDummy'),
  'Jigsaw': require('./backends/Jigsaw'),
  'JigsawDummy': require('./backends/JigsawDummy'),
  'SingleView': require('./backends/SingleView')
}

let QueryHandler = {
  customerSearch: function(query, systems, cb){
    let queryCount = systems.length;
    let results = [];
    systems.forEach(system => {
      backends[system].customerSearch(query, result => {
        queryCount--;

        results = results.concat(result)
        if(queryCount == 0){
          cb({results: results});
        }
      })
    })
  }
}

module.exports = QueryHandler;