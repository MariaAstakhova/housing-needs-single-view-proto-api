SELECT
	CCDocument.*
FROM
	CCDocument
JOIN BENCLAIM ON CCDocument.BenPersonReference = BENCLAIM.PERSONREFERENCE
WHERE
	BENCLAIM.CTREFERENCE = @account_ref
ORDER BY DocDate DESC;