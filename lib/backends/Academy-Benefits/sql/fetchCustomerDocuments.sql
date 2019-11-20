SELECT
	*
FROM
	hbdocout
WHERE
	claim_id = @claim_id
	AND sent_date != ''
ORDER BY
	sent_date ASC