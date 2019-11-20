SELECT
	TOP 20
	cttransaction.process_date as date,
	cttransaction.tran_amount as amount,
	cttrancode.tran_desc as description
FROM
	cttransaction
	JOIN cttrancode ON cttransaction.tran_code = cttrancode.tran_code
WHERE
	account_ref = @account_ref
	ORDER BY process_date DESC
