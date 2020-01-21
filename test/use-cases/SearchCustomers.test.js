describe('SearchCustomers', () => {
  const resultsA = [
    {
      id: 1
    },
    {
      id: 2
    }
  ];

  const resultsB = [
    {
      id: 5
    }
  ];

  let backends;
  let searchCustomers;

  beforeEach(() => {
    backends = {
      a: {
        customerSearch: jest.fn().mockResolvedValue(resultsA)
      },
      b: {
        customerSearch: jest.fn().mockResolvedValue(resultsB)
      }
    };
    searchCustomers = require('../../lib/use-cases/SearchCustomers')({
      backends
    });
  });

  it('searches for customers on multiple systems', async () => {
    const query = {
      firstName: 'john',
      lastName: 'smith'
    };

    await searchCustomers(query);

    Object.values(backends).forEach(backend => {
      expect(backend.customerSearch).toHaveBeenCalledWith(query);
    });
  });

  it('concatenates the results', async () => {
    const expectedResults = [].concat(resultsA, resultsB);

    const results = await searchCustomers({});

    expect(results).toEqual(expect.arrayContaining(expectedResults));
    expect(results.length).toEqual(expectedResults.length);
  });
});
