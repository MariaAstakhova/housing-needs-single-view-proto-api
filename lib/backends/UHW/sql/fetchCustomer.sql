SELECT
	ContactNo,
	Title,
	Forenames,
	Surname,
	DOB,
	Addr1,
	Addr2,
	Addr3,
	Addr4,
	PostCode,
	EmailAddress,
	UHContact
FROM
	CCContact
WHERE
	ContactNo = @id