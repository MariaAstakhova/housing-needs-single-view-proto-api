let Backend = {
  customerSearch: function(query, cb) {
    cb([
      {
        id: '32819',
        firstName: 'Eileen',
        lastName: 'Clough',
        dob: '28/05/1976',
        nino: 'DD123988D',
        source: 'Jigsaw'
      },
      {
        id: '98324',
        firstName: 'Eileen',
        lastName: 'McClough',
        dob: '18/02/1974',
        nino: 'HS109833A',
        source: 'Jigsaw'
      }
    ]);
  }
};

module.exports = Backend;
