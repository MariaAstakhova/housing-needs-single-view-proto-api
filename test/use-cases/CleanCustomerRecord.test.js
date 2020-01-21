describe('CleanCustomerRecord', () => {
  const badAddress = '22 Barretts Grove, London E5 0EY';
  const badDob = '01/11/1920';

  const cleanCustomerRecord = require('../../lib/use-cases/CleanCustomerRecord')(
    {
      badData: {
        address: [badAddress],
        dob: [badDob]
      }
    }
  );

  it(`removes invalid dob's`, () => {
    const record = {
      dob: badDob
    };

    const result = cleanCustomerRecord(record);

    expect(result.dob).toBeNull();
  });

  it(`leaves valid dob's as they are`, () => {
    const record = {
      dob: '01/01/1905'
    };

    const result = cleanCustomerRecord(record);

    expect(result.dob).toBe(record.dob);
  });

  it('removes bad address when single address', () => {
    const record = {
      address: badAddress
    };

    const result = cleanCustomerRecord(record);

    expect(result.address).toBeNull();
  });

  it('leaves valid address when single address', () => {
    const record = {
      address: 'This address is good'
    };

    const result = cleanCustomerRecord(record);

    expect(result.address).toBe(record.address);
  });

  it('removes bad address from array of addresses', () => {});

  it('leaves valid address in array of addresses', () => {});
});
