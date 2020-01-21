module.exports = options => {
  const backends = options.backends;

  return async query => {
    const requests = Object.values(backends).map(async backend =>
      backend.customerSearch(query)
    );

    return [].concat.apply([], await Promise.all(requests));
  };
};
